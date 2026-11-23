import type { DataSource } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export interface SyncContext {
  prisma: PrismaService;
  source: DataSource;
  /** Adapter-specific, non-secret configuration stored on the DataSource. */
  config: Record<string, unknown>;
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  log: (message: string) => void;
}

export interface SyncResult {
  read: number;
  created: number;
  updated: number;
  failed: number;
  details?: Record<string, unknown>;
}

export class AdapterConfigurationError extends Error {}

/**
 * A provider adapter. Each provider lives behind this interface so it can be replaced
 * without touching the core application. Adapters only write through Prisma and always
 * set sourceId / sourceReference / syncedAt / verification on the records they touch.
 */
export interface DataAdapter {
  readonly key: string;
  /** Environment variables that must be present (secrets). */
  readonly requiredEnv?: string[];
  /** Config keys that must be present on the DataSource. */
  readonly requiredConfig?: string[];
  /** On-demand providers (e.g. Google Places) cannot bulk-sync under their terms. */
  readonly onDemandOnly?: boolean;
  sync(ctx: SyncContext): Promise<SyncResult>;
}

export const emptyResult = (): SyncResult => ({ read: 0, created: 0, updated: 0, failed: 0 });
