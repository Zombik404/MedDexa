import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { MARKETS, pricePerUnit, type MedicineSummary, type PriceComparisonView, type PriceOfferView } from '@meddexa/shared';
import { toProvenance } from '../common/mappers';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { FxService, type FxTable } from './fx.service';

const offerInclude = {
  package: true,
  pharmacy: true,
  price: true,
  source: true,
  availability: { orderBy: { observedAt: 'desc' }, take: 1 },
} satisfies Prisma.PharmacyOfferInclude;
type OfferRow = Prisma.PharmacyOfferGetPayload<{ include: typeof offerInclude }>;

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get staleMs() {
    return this.config.get('PRICE_STALE_DAYS', { infer: true }) * 86_400_000;
  }

  private demoWhere(): Prisma.PharmacyOfferWhereInput {
    return this.config.get('ALLOW_DEMO_DATA', { infer: true }) ? {} : { isDemo: false };
  }

  toView(o: OfferRow, currency: string, table: FxTable | null): PriceOfferView | null {
    if (!o.price) return null;
    const amount = Number(o.price.amount);
    const local = { amount, currency: o.price.currency };
    const convertedAmount = o.price.currency === currency ? null : this.fx.convert(amount, o.price.currency, currency, table);
    const pack = { quantity: Number(o.package.quantity), unit: o.package.unit };
    const unit = pricePerUnit(convertedAmount ?? amount, pack);
    const stale = o.price.verification === 'OUTDATED' || Date.now() - o.price.observedAt.getTime() > this.staleMs;
    const availability = o.availability[0];
    return {
      id: o.id,
      medicineId: o.package.medicineId,
      pharmacy: o.pharmacy
        ? { id: o.pharmacy.id, name: o.pharmacy.name, city: o.pharmacy.city, countryCode: o.pharmacy.countryCode }
        : null,
      countryCode: o.countryCode,
      local,
      converted:
        convertedAmount != null && table
          ? { amount: convertedAmount, currency, rateDate: table.date, rateSource: table.isFallback ? `${table.source} (development fallback)` : table.source }
          : null,
      packageSize: pack,
      perUnit: unit ? { amount: Math.round(unit.value * 10_000) / 10_000, currency: convertedAmount != null ? currency : o.price.currency, per: unit.per } : null,
      priceType: o.price.priceType,
      availability: availability?.status ?? 'UNKNOWN',
      availabilityUpdatedAt: availability?.observedAt.toISOString() ?? null,
      observedAt: o.price.observedAt.toISOString(),
      stale,
      provenance: toProvenance(
        { sourceId: o.sourceId, sourceReference: o.sourceReference, syncedAt: o.price.updatedAt, verification: stale && o.price.verification === 'VERIFIED' ? 'OUTDATED' : o.price.verification, isDemo: o.isDemo },
        o.source,
        o.countryCode,
      ),
    };
  }

  async forMedicine(medicineId: string, currency: string, country?: string): Promise<PriceComparisonView> {
    const exists = await this.prisma.medicine.findUnique({ where: { id: medicineId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Medicine not found');
    const table = await this.fx.table();
    const offers = await this.prisma.pharmacyOffer.findMany({
      where: { package: { medicineId }, countryCode: country, price: { isNot: null }, ...this.demoWhere() },
      include: offerInclude,
    });
    const views = offers
      .map((o) => this.toView(o, currency, table))
      .filter((v): v is PriceOfferView => v !== null)
      .sort((a, b) => Number(a.stale) - Number(b.stale) || (a.converted?.amount ?? a.local.amount) - (b.converted?.amount ?? b.local.amount));

    const covered = new Set(views.map((v) => v.countryCode));
    const snapshots = await this.prisma.priceSnapshot.findMany({
      where: { offer: { package: { medicineId, isDefault: true }, countryCode: country, ...this.demoWhere() } },
      include: { offer: { select: { countryCode: true } } },
      orderBy: { capturedAt: 'asc' },
    });
    // Monthly average per country, converted to the requested currency.
    const buckets = new Map<string, { sum: number; n: number; date: string; country: string }>();
    for (const s of snapshots) {
      const amount = this.fx.convert(Number(s.amount), s.currency, currency, table);
      if (amount == null) continue;
      const date = s.capturedAt.toISOString().slice(0, 7) + '-01';
      const key = `${s.offer.countryCode}:${date}`;
      const b = buckets.get(key) ?? { sum: 0, n: 0, date, country: s.offer.countryCode };
      b.sum += amount;
      b.n++;
      buckets.set(key, b);
    }

    return {
      medicineId,
      currency,
      offers: views,
      countriesWithoutData: MARKETS.map((m) => m.code).filter((c) => !covered.has(c) && (!country || c === country)),
      rates: table ? { date: table.date, source: table.source, isFallback: table.isFallback } : null,
      history: [...buckets.values()].map((b) => ({ date: b.date, countryCode: b.country, amount: Math.round((b.sum / b.n) * 100) / 100, currency })),
    };
  }

  /** Lowest non-stale price per medicine, converted to the requested currency. */
  async lowestPrices(medicineIds: string[], currency: string): Promise<Map<string, NonNullable<MedicineSummary['lowestPrice']>>> {
    const out = new Map<string, NonNullable<MedicineSummary['lowestPrice']>>();
    if (!medicineIds.length) return out;
    const table = await this.fx.table();
    const offers = await this.prisma.pharmacyOffer.findMany({
      where: {
        package: { medicineId: { in: medicineIds } },
        price: { is: { observedAt: { gte: new Date(Date.now() - this.staleMs) }, verification: { not: 'OUTDATED' } } },
        ...this.demoWhere(),
      },
      include: { price: true, package: { select: { medicineId: true } } },
    });
    for (const o of offers) {
      const p = o.price!;
      const amount = this.fx.convert(Number(p.amount), p.currency, currency, table);
      if (amount == null) continue;
      const current = out.get(o.package.medicineId);
      if (!current || amount < current.amount) {
        out.set(o.package.medicineId, { amount, currency, converted: p.currency !== currency, countryCode: o.countryCode });
      }
    }
    return out;
  }

  async bestOfferForMedicine(medicineId: string, currency: string, table: FxTable | null): Promise<PriceOfferView | null> {
    const offers = await this.prisma.pharmacyOffer.findMany({
      where: { package: { medicineId, isDefault: true }, price: { isNot: null }, ...this.demoWhere() },
      include: offerInclude,
    });
    const views = offers.map((o) => this.toView(o, currency, table)).filter((v): v is PriceOfferView => !!v && !v.stale);
    views.sort((a, b) => (a.converted?.amount ?? a.local.amount) - (b.converted?.amount ?? b.local.amount));
    return views[0] ?? null;
  }
}
