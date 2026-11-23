import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { convert, MissingRateError, roundMoney, type RateTable } from '@meddexa/shared';
import { CacheService } from '../common/cache.service';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface FxTable extends RateTable {
  isFallback: boolean;
}

@Injectable()
export class FxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Latest rate table from a real provider; falls back to labelled demo rates in development. */
  async table(): Promise<FxTable | null> {
    return this.cache.wrap('fx:table', 600, async () => {
      const allowDemo = this.config.get('ALLOW_DEMO_DATA', { infer: true });
      const latest = await this.prisma.exchangeRate.findFirst({
        where: { source: { isDemo: false } },
        orderBy: { rateDate: 'desc' },
      });
      const fallback = !latest && allowDemo;
      const pick = latest ?? (fallback ? await this.prisma.exchangeRate.findFirst({ where: { source: { isDemo: true } }, orderBy: { rateDate: 'desc' } }) : null);
      if (!pick) return null;
      const rows = await this.prisma.exchangeRate.findMany({
        where: { rateDate: pick.rateDate, sourceId: pick.sourceId },
        include: { source: true },
      });
      return {
        base: 'EUR' as const,
        date: pick.rateDate.toISOString().slice(0, 10),
        source: rows[0]?.source.name ?? pick.sourceId,
        rates: Object.fromEntries(rows.map((r) => [r.currency, Number(r.rate)])),
        isFallback: fallback,
      };
    });
  }

  /** Converts and rounds; returns null when a rate is missing (never guesses). */
  convert(amount: number, from: string, to: string, table: FxTable | null): number | null {
    if (from === to) return amount;
    if (!table) return null;
    try {
      return roundMoney(convert(amount, from, to, table), to);
    } catch (e) {
      if (e instanceof MissingRateError) return null;
      throw e;
    }
  }
}
