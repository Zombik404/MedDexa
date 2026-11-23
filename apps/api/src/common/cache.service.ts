import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../config/env';

/**
 * Small JSON cache. Uses Redis when REDIS_URL is configured, otherwise a bounded
 * in-process map (fine for a single API instance and for tests).
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, { value: string; expires: number }>();

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('REDIS_URL', { infer: true });
    this.redis = url ? new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 }) : null;
    this.redis?.on('error', (e) => this.logger.warn(`Redis error: ${e.message}`));
  }

  get usingRedis() {
    return this.redis !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.redis) return true;
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis) {
        const v = await this.redis.get(key);
        return v ? (JSON.parse(v) as T) : null;
      }
      const hit = this.memory.get(key);
      if (!hit || hit.expires < Date.now()) return null;
      return JSON.parse(hit.value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const json = JSON.stringify(value);
    try {
      if (this.redis) {
        await this.redis.set(key, json, 'EX', ttlSeconds);
        return;
      }
      if (this.memory.size > 2000) this.memory.delete(this.memory.keys().next().value!);
      this.memory.set(key, { value: json, expires: Date.now() + ttlSeconds * 1000 });
    } catch (e) {
      this.logger.warn(`Cache set failed: ${(e as Error).message}`);
    }
  }

  async del(prefix: string): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length) await this.redis.del(...keys);
      return;
    }
    for (const k of this.memory.keys()) if (k.startsWith(prefix)) this.memory.delete(k);
  }

  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }
}
