import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { compareMedicines, type CompareResponse, type PriceOfferView } from '@meddexa/shared';
import { medicineInclude, toComparable } from '../common/mappers';
import type { RequestUser } from '../common/decorators';
import { AnalyticsService } from '../analytics/analytics.service';
import { MedicinesService } from '../medicines/medicines.service';
import { FxService } from '../prices/fx.service';
import { PricesService } from '../prices/prices.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly medicines: MedicinesService,
    private readonly prices: PricesService,
    private readonly fx: FxService,
    private readonly analytics: AnalyticsService,
  ) {}

  async compare(ids: string[], currency: string, user: RequestUser | null, save: boolean): Promise<CompareResponse> {
    const rows = await this.prisma.medicine.findMany({ where: { id: { in: ids } }, include: medicineInclude });
    if (rows.length !== ids.length) {
      const found = new Set(rows.map((r) => r.id));
      throw new NotFoundException({ message: 'Some medicines were not found', code: 'MEDICINE_NOT_FOUND', details: ids.filter((i) => !found.has(i)) });
    }
    const ordered = ids.map((id) => rows.find((r) => r.id === id)!);
    let result;
    try {
      result = compareMedicines(ordered.map(toComparable));
    } catch (e) {
      throw new BadRequestException({ message: (e as Error).message, code: 'COMPARE_INVALID' });
    }
    const table = await this.fx.table();
    const [summaries, offers] = await Promise.all([
      this.medicines.summaries(ids, currency),
      Promise.all(ids.map((id) => this.prices.bestOfferForMedicine(id, currency, table))),
    ]);
    const prices: Record<string, PriceOfferView | null> = Object.fromEntries(ids.map((id, i) => [id, offers[i] ?? null]));

    this.analytics.record('COMPARE', { query: ids.join(','), resultCount: ids.length });
    if (user && save) {
      await this.prisma.comparisonHistory.create({ data: { userId: user.id, medicineIds: ids } });
    }
    return { medicines: summaries, result, prices };
  }
}
