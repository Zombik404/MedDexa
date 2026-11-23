import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CacheService } from '../common/cache.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Liveness: the process is up. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: database and cache reachable; integration status summarised. */
  @Get()
  async ready() {
    const started = Date.now();
    const db = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const cache = await this.cache.ping();
    const sources = db
      ? await this.prisma.dataSource.findMany({ where: { enabled: true }, select: { id: true, lastStatus: true, lastSyncAt: true } })
      : [];
    const body = {
      status: db && cache ? 'ok' : 'degraded',
      checks: { database: db, cache: cache, cacheBackend: this.cache.usingRedis ? 'redis' : 'memory' },
      integrations: sources,
      latencyMs: Date.now() - started,
      version: process.env.npm_package_version ?? '0.1.0',
    };
    if (!db) throw new ServiceUnavailableException(body);
    return body;
  }
}
