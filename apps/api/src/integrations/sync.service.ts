import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AdapterConfigurationError } from './adapter';
import { ADAPTERS } from './registry';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Checks whether a source can run, without running it. */
  async readiness(sourceId: string) {
    const source = await this.prisma.dataSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException('Data source not found');
    const adapter = ADAPTERS[source.adapter];
    const missingEnv = (adapter?.requiredEnv ?? []).filter((k) => !process.env[k]);
    const cfg = (source.config ?? {}) as Record<string, unknown>;
    const missingConfig = (adapter?.requiredConfig ?? []).filter((k) => cfg[k] == null);
    return { adapterFound: !!adapter, onDemandOnly: !!adapter?.onDemandOnly, missingEnv, missingConfig };
  }

  async run(sourceId: string, trigger = 'manual') {
    const source = await this.prisma.dataSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException('Data source not found');
    if (this.running.has(sourceId)) return { status: 'SKIPPED' as const, reason: 'already running' };
    const adapter = ADAPTERS[source.adapter];
    const log = await this.prisma.dataSynchronizationLog.create({ data: { sourceId, status: 'RUNNING', trigger } });
    const messages: string[] = [];
    this.running.add(sourceId);
    try {
      if (!adapter) throw new AdapterConfigurationError(`No adapter registered for "${source.adapter}"`);
      const ready = await this.readiness(sourceId);
      if (ready.missingEnv.length || ready.missingConfig.length) {
        throw new AdapterConfigurationError(
          `Missing ${[...ready.missingEnv.map((e) => `env ${e}`), ...ready.missingConfig.map((c) => `config "${c}"`)].join(', ')}`,
        );
      }
      const result = await adapter.sync({
        prisma: this.prisma,
        source,
        config: (source.config ?? {}) as Record<string, unknown>,
        env: process.env,
        fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(120_000) }),
        log: (m) => {
          messages.push(m);
          this.logger.log(`[${sourceId}] ${m}`);
        },
      });
      const status = result.failed > 0 ? 'PARTIAL' : 'SUCCESS';
      await this.finish(log.id, sourceId, status, {
        recordsRead: result.read,
        recordsCreated: result.created,
        recordsUpdated: result.updated,
        recordsFailed: result.failed,
        details: { ...(result.details ?? {}), messages: messages.slice(-50) } as Prisma.InputJsonValue,
      });
      return { status, ...result };
    } catch (e) {
      const error = (e as Error).message;
      const status = e instanceof AdapterConfigurationError ? 'SKIPPED' : 'FAILED';
      this.logger.warn(`[${sourceId}] ${status}: ${error}`);
      await this.finish(log.id, sourceId, status, { error, details: { messages } as Prisma.InputJsonValue });
      return { status, error };
    } finally {
      this.running.delete(sourceId);
    }
  }

  private async finish(logId: string, sourceId: string, status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED', data: Prisma.DataSynchronizationLogUpdateInput) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.dataSynchronizationLog.update({ where: { id: logId }, data: { ...data, status, finishedAt: now } }),
      this.prisma.dataSource.update({ where: { id: sourceId }, data: { lastSyncAt: now, lastStatus: status } }),
    ]);
  }

  private get schedulerOn() {
    return this.config.get('ENABLE_SCHEDULER', { infer: true }) && this.config.get('NODE_ENV', { infer: true }) !== 'test';
  }

  /** ECB publishes reference rates around 16:00 CET on working days. */
  @Cron('15 17 * * 1-5', { timeZone: 'Europe/Berlin' })
  async syncFx() {
    if (!this.schedulerOn) return;
    const sources = await this.prisma.dataSource.findMany({ where: { enabled: true, kind: 'FX', isDemo: false } });
    for (const s of sources) await this.run(s.id, 'schedule');
  }

  /** Weekly refresh of every other enabled, non-demo provider (Sunday 03:00). */
  @Cron('0 3 * * 0', { timeZone: 'Europe/Berlin' })
  async syncWeekly() {
    if (!this.schedulerOn) return;
    const sources = await this.prisma.dataSource.findMany({ where: { enabled: true, isDemo: false, NOT: { kind: 'FX' } } });
    for (const s of sources) {
      if (!ADAPTERS[s.adapter]?.onDemandOnly) await this.run(s.id, 'schedule');
    }
  }
}
