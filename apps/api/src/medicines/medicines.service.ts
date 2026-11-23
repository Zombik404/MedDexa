import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  comparePair,
  type MedicineDetail,
  type MedicineSearchQuery,
  type MedicineSummary,
  type Paged,
  type SimilarMedicine,
} from '@meddexa/shared';
import { medicineInclude, toComparable, toMedicineSummary, toProvenance } from '../common/mappers';
import type { RequestUser } from '../common/decorators';
import type { Env } from '../config/env';
import { AnalyticsService } from '../analytics/analytics.service';
import { PricesService } from '../prices/prices.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';

const COMPOSITION_ORDER = { SAME_COMBINATION: 0, SAME_ACTIVE_INGREDIENT: 0, SIMILAR_COMPOSITION: 1, NO_SHARED_INGREDIENTS: 2 };

@Injectable()
export class MedicinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    private readonly prices: PricesService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private demoWhere(): Prisma.MedicineWhereInput {
    return this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? {} : { isDemo: false };
  }

  /** Loads medicines with relations, ratings and prices, preserving the order of ids. */
  async summaries(ids: string[], currency: string): Promise<MedicineSummary[]> {
    if (!ids.length) return [];
    const [rows, ratings, prices] = await Promise.all([
      this.prisma.medicine.findMany({ where: { id: { in: ids } }, include: medicineInclude }),
      this.prisma.review.groupBy({
        by: ['medicineId'],
        where: { medicineId: { in: ids }, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prices.lowestPrices(ids, currency),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ratingBy = new Map(ratings.map((r) => [r.medicineId!, { average: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count._all }]));
    return ids
      .map((id) => byId.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => toMedicineSummary(m, { rating: ratingBy.get(m.id) ?? null, lowestPrice: prices.get(m.id) ?? null }));
  }

  async searchMedicines(query: MedicineSearchQuery, currency: string, user: RequestUser | null): Promise<Paged<MedicineSummary>> {
    const { ids, total } = await this.search.search(query);
    const items = await this.summaries(ids, currency);
    if (query.q && query.page === 1) {
      this.analytics.record('SEARCH', { query: query.q, resultCount: total, countryCode: query.country });
      if (user) await this.saveHistory(user.id, query, total);
    }
    return { items, page: query.page, pageSize: query.pageSize, total, hasMore: query.page * query.pageSize < total };
  }

  private async saveHistory(userId: string, query: MedicineSearchQuery, total: number) {
    const prefs = await this.prisma.userPreferences.findUnique({ where: { userId } });
    if (prefs && !prefs.saveSearchHistory) return;
    const { q, page: _p, pageSize: _ps, sort: _s, currency: _c, ...filters } = query;
    const cleaned = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined));
    await this.prisma.searchHistory.create({
      data: { userId, query: q!, filters: Object.keys(cleaned).length ? (cleaned as Prisma.InputJsonValue) : undefined, resultCount: total },
    });
  }

  async detail(id: string, currency: string, user: RequestUser | null): Promise<MedicineDetail> {
    const m = await this.prisma.medicine.findFirst({
      where: { id, ...this.demoWhere() },
      include: {
        ...medicineInclude,
        synonyms: true,
        registrations: { include: { source: true }, orderBy: { countryCode: 'asc' } },
        documents: { include: { source: true } },
        safety: { include: { source: true } },
      },
    });
    if (!m) throw new NotFoundException({ message: 'Medicine not found', code: 'MEDICINE_NOT_FOUND' });
    const [summary] = await this.summaries([m.id], currency);
    this.analytics.record('VIEW_MEDICINE', { entityId: m.id });
    if (user) {
      await this.prisma.recentlyViewed.upsert({
        where: { userId_medicineId: { userId: user.id, medicineId: m.id } },
        update: { viewedAt: new Date() },
        create: { userId: user.id, medicineId: m.id },
      });
    }
    return {
      ...summary!,
      synonyms: m.synonyms.map((s) => ({ name: s.name, language: s.language, countryCode: s.countryCode })),
      barcodes: m.packages.map((p) => p.barcode).filter((b): b is string => !!b),
      registrations: m.registrations.map((r) => ({
        id: r.id,
        countryCode: r.countryCode,
        authority: r.authority,
        registrationNumber: r.registrationNumber,
        localName: r.localName,
        status: r.status,
        authorisedAt: r.authorisedAt?.toISOString() ?? null,
        provenance: toProvenance(r, r.source, r.countryCode),
      })),
      documents: m.documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        language: d.language,
        countryCode: d.countryCode,
        url: d.url,
        provenance: toProvenance(d, d.source, d.countryCode),
      })),
      safety: m.safety.map((s) => ({
        kind: s.kind,
        language: s.language,
        countryCode: s.countryCode,
        content: s.content,
        provenance: toProvenance(s, s.source, s.countryCode),
      })),
      provenance: toProvenance(m, m.source, m.countryCode),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  /**
   * Products that share at least one active moiety, classified by the comparison engine.
   * Classification describes composition only; it is not a substitution recommendation.
   */
  async similar(id: string, currency: string): Promise<SimilarMedicine[]> {
    const base = await this.prisma.medicine.findUnique({ where: { id }, include: medicineInclude });
    if (!base) throw new NotFoundException({ message: 'Medicine not found', code: 'MEDICINE_NOT_FOUND' });
    const moietyIds = base.ingredients.map((i) => i.ingredient.moietyId ?? i.ingredientId);
    if (!moietyIds.length) return [];
    const candidates = await this.prisma.medicine.findMany({
      where: {
        id: { not: id },
        status: 'ACTIVE',
        duplicateOfId: null,
        ...this.demoWhere(),
        ingredients: { some: { OR: [{ ingredientId: { in: moietyIds } }, { ingredient: { moietyId: { in: moietyIds } } }] } },
      },
      include: medicineInclude,
      take: 60,
    });
    const ref = toComparable(base);
    const ranked = candidates
      .map((c) => ({ c, pair: comparePair(ref, toComparable(c)) }))
      .sort(
        (a, b) =>
          COMPOSITION_ORDER[a.pair.composition] - COMPOSITION_ORDER[b.pair.composition] ||
          a.pair.differences.filter((d) => d.severity === 'critical' || d.severity === 'major').length -
            b.pair.differences.filter((d) => d.severity === 'critical' || d.severity === 'major').length,
      )
      .slice(0, 20);
    const summaries = await this.summaries(ranked.map((r) => r.c.id), currency);
    return summaries.map((s, i) => ({ medicine: s, composition: ranked[i]!.pair.composition }));
  }

  async popular(currency: string, limit = 10): Promise<MedicineSummary[]> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const views = await this.prisma.analyticsEvent.groupBy({
      by: ['entityId'],
      where: { type: 'VIEW_MEDICINE', createdAt: { gte: since }, entityId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { entityId: 'desc' } },
      take: limit,
    });
    let ids = views.map((v) => v.entityId!);
    if (ids.length < limit) {
      const more = await this.prisma.medicine.findMany({
        where: { status: 'ACTIVE', duplicateOfId: null, id: { notIn: ids }, ...this.demoWhere() },
        orderBy: [{ registrations: { _count: 'desc' } }, { name: 'asc' }],
        take: limit - ids.length,
        select: { id: true },
      });
      ids = ids.concat(more.map((m) => m.id));
    }
    return this.summaries(ids, currency);
  }

  async popularSearches(limit = 8): Promise<string[]> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['query'],
      where: { type: 'SEARCH', createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, query: { not: null }, resultCount: { gt: 0 } },
      _count: { _all: true },
      orderBy: { _count: { query: 'desc' } },
      take: limit,
    });
    return rows.map((r) => r.query!).filter(Boolean);
  }

  async categories() {
    const rows = await this.prisma.$queryRaw<{ code: string; name: string; count: bigint }[]>(Prisma.sql`
      SELECT a.code, a.name, count(m.id) AS count
      FROM atc_classes a
      LEFT JOIN medicines m ON left(m."atcCode", 1) = a.code AND m.status = 'ACTIVE' AND m."duplicateOfId" IS NULL
        ${this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? Prisma.empty : Prisma.sql`AND m."isDemo" = false`}
      WHERE a.level = 1
      GROUP BY a.code, a.name
      ORDER BY count DESC, a.code`);
    return rows.map((r) => ({ code: r.code, name: r.name, count: Number(r.count) }));
  }
}
