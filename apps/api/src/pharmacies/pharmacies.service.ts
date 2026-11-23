import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { normalizeText, type Paged, type PharmacyDetail, type PharmacySearchQuery, type PharmacySummary } from '@meddexa/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import type { RequestUser } from '../common/decorators';
import { toProvenance } from '../common/mappers';
import type { Env } from '../config/env';
import { googleNearbyPharmacies, mapGooglePlace } from '../integrations/adapters/google-places.adapter';
import { PrismaService } from '../prisma/prisma.service';
import { isOpenNow } from './opening';

const EARTH_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

const pharmacyInclude = { openingHours: true, country: true } satisfies Prisma.PharmacyInclude;

@Injectable()
export class PharmaciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get allowDemo() {
    return this.config.get('ALLOW_DEMO_DATA', { infer: true });
  }

  async search(q: PharmacySearchQuery): Promise<Paged<PharmacySummary>> {
    const where: Prisma.Sql[] = [Prisma.sql`p.status = 'ACTIVE'`];
    if (!this.allowDemo) where.push(Prisma.sql`p."isDemo" = false`);
    const geo = q.lat != null && q.lng != null;
    const distance = geo
      ? Prisma.sql`(${2 * EARTH_KM} * asin(sqrt(power(sin(radians(p.lat - ${q.lat}) / 2), 2) + cos(radians(${q.lat})) * cos(radians(p.lat)) * power(sin(radians(p.lng - ${q.lng}) / 2), 2))))`
      : Prisma.sql`NULL::float`;
    if (geo) {
      // Bounding box first so the (lat, lng) index can be used, then exact distance.
      const dLat = q.radiusKm / 111;
      const dLng = q.radiusKm / (111 * Math.max(Math.cos((q.lat! * Math.PI) / 180), 0.01));
      where.push(Prisma.sql`p.lat BETWEEN ${q.lat! - dLat} AND ${q.lat! + dLat} AND p.lng BETWEEN ${q.lng! - dLng} AND ${q.lng! + dLng}`);
      where.push(Prisma.sql`${distance} <= ${q.radiusKm}`);
    }
    if (q.q) {
      const t = normalizeText(q.q);
      where.push(Prisma.sql`(p."normalizedName" LIKE ${'%' + t + '%'} OR lower(unaccent(p.street)) LIKE ${'%' + t + '%'}
        OR lower(unaccent(coalesce(p.city, ''))) LIKE ${t + '%'} OR p.postcode LIKE ${q.q.trim() + '%'}
        OR word_similarity(${t}, p."normalizedName") > 0.5)`);
    }
    if (q.city) where.push(Prisma.sql`lower(unaccent(coalesce(p.city, ''))) = ${normalizeText(q.city)}`);
    if (q.postcode) where.push(Prisma.sql`replace(p.postcode, ' ', '') LIKE ${q.postcode.replace(/\s/g, '') + '%'}`);
    if (q.country) where.push(Prisma.sql`p."countryCode" = ${q.country}`);
    if (q.verifiedOnly) where.push(Prisma.sql`p.verification = 'VERIFIED'`);
    for (const s of q.services ?? []) {
      where.push(Prisma.sql`EXISTS (SELECT 1 FROM pharmacy_service_links l WHERE l."pharmacyId" = p.id AND l."serviceCode" = ${s})`);
    }
    const rating = Prisma.sql`(SELECT avg(r.rating) FROM reviews r WHERE r."pharmacyId" = p.id AND r.status = 'PUBLISHED')`;
    if (q.minRating) where.push(Prisma.sql`${rating} >= ${q.minRating}`);
    if (q.openNow) {
      where.push(Prisma.sql`EXISTS (
        SELECT 1 FROM opening_hours h,
          LATERAL (SELECT (now() AT TIME ZONE coalesce(p.timezone, c.timezone)) AS t) lt
        WHERE h."pharmacyId" = p.id AND (
          (h.day = extract(isodow FROM lt.t)::int - 1 AND to_char(lt.t, 'HH24:MI') >= h.opens AND (h.closes < h.opens OR to_char(lt.t, 'HH24:MI') < h.closes))
          OR (h.day = (extract(isodow FROM lt.t)::int + 5) % 7 AND h.closes < h.opens AND to_char(lt.t, 'HH24:MI') < h.closes)))`);
    }
    const sort = q.sort ?? (geo ? 'distance' : 'name');
    const order = {
      distance: geo ? Prisma.sql`distance ASC` : Prisma.sql`p.name ASC`,
      rating: Prisma.sql`rating DESC NULLS LAST, p.name ASC`,
      name: Prisma.sql`p.name ASC`,
    }[sort];

    const offset = (q.page - 1) * q.pageSize;
    const rows = await this.prisma.$queryRaw<{ id: string; distance: number | null; rating: number | null; reviews: bigint; total: bigint }[]>(Prisma.sql`
      SELECT p.id, ${distance} AS distance, ${rating}::float AS rating,
        (SELECT count(*) FROM reviews r WHERE r."pharmacyId" = p.id AND r.status = 'PUBLISHED') AS reviews,
        count(*) OVER() AS total
      FROM pharmacies p JOIN countries c ON c.code = p."countryCode"
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY ${order}
      LIMIT ${q.pageSize} OFFSET ${offset}`);

    const full = await this.prisma.pharmacy.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: pharmacyInclude });
    const byId = new Map(full.map((p) => [p.id, p]));
    const items = rows.map((r) => {
      const p = byId.get(r.id)!;
      return this.toSummary(p, r.distance, r.rating != null ? { average: Math.round(r.rating * 10) / 10, count: Number(r.reviews) } : null);
    });
    const total = rows.length ? Number(rows[0]!.total) : 0;
    if (q.page === 1) this.analytics.record('PHARMACY_SEARCH', { query: q.q ?? q.city ?? q.postcode, countryCode: q.country, resultCount: total });
    return { items, page: q.page, pageSize: q.pageSize, total, hasMore: q.page * q.pageSize < total };
  }

  toSummary(
    p: Prisma.PharmacyGetPayload<{ include: typeof pharmacyInclude }>,
    distanceKm: number | null,
    rating: PharmacySummary['rating'],
  ): PharmacySummary {
    return {
      id: p.id,
      name: p.name,
      address: [p.street, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      city: p.city,
      postcode: p.postcode,
      countryCode: p.countryCode,
      lat: p.lat,
      lng: p.lng,
      distanceKm: distanceKm != null ? Math.round(distanceKm * 100) / 100 : null,
      openNow: isOpenNow(p.openingHours, p.timezone ?? p.country.timezone),
      rating,
      verified: p.verification === 'VERIFIED',
      isDemo: p.isDemo,
    };
  }

  async summariesByIds(ids: string[]): Promise<PharmacySummary[]> {
    const rows = await this.prisma.pharmacy.findMany({ where: { id: { in: ids } }, include: pharmacyInclude });
    return ids.map((id) => rows.find((r) => r.id === id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => this.toSummary(p, null, null));
  }

  async detail(id: string, user: RequestUser | null, lat?: number, lng?: number): Promise<PharmacyDetail> {
    const p = await this.prisma.pharmacy.findFirst({
      where: { id, ...(this.allowDemo ? {} : { isDemo: false }) },
      include: { ...pharmacyInclude, services: { include: { service: true } }, source: true, _count: { select: { offers: true } } },
    });
    if (!p) throw new NotFoundException({ message: 'Pharmacy not found', code: 'PHARMACY_NOT_FOUND' });
    const agg = await this.prisma.review.aggregate({
      where: { pharmacyId: id, status: 'PUBLISHED' },
      _avg: { rating: true, staffRating: true, serviceRating: true, waitingRating: true, cleanlinessRating: true, accessibilityRating: true },
      _count: { _all: true },
    });
    const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
    this.analytics.record('VIEW_PHARMACY', { entityId: id, countryCode: p.countryCode });
    if (user) {
      await this.prisma.recentlyViewed.upsert({
        where: { userId_pharmacyId: { userId: user.id, pharmacyId: id } },
        update: { viewedAt: new Date() },
        create: { userId: user.id, pharmacyId: id },
      });
    }
    const distance = lat != null && lng != null ? haversineKm(lat, lng, p.lat, p.lng) : null;
    return {
      ...this.toSummary(p, distance, agg._count._all ? { average: r1(agg._avg.rating)!, count: agg._count._all } : null),
      // Contact actions are only offered for details that are verified.
      phone: p.phone,
      phoneVerified: p.phoneVerified,
      website: p.website,
      websiteVerified: p.websiteVerified,
      email: p.email,
      openingHours: p.openingHours.map((h) => ({ day: h.day, opens: h.opens, closes: h.closes })).sort((a, b) => a.day - b.day || a.opens.localeCompare(b.opens)),
      services: p.services.map((s) => ({ code: s.service.code, name: s.service.name })),
      ratingBreakdown: agg._count._all
        ? {
            staff: r1(agg._avg.staffRating),
            service: r1(agg._avg.serviceRating),
            waiting: r1(agg._avg.waitingRating),
            cleanliness: r1(agg._avg.cleanlinessRating),
            accessibility: r1(agg._avg.accessibilityRating),
          }
        : null,
      offersCount: p._count.offers,
      provenance: toProvenance(p, p.source, p.countryCode),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /** Live, uncached Google Places results (on-demand provider). */
  async googleNearby(lat: number, lng: number, radiusKm: number): Promise<PharmacySummary[]> {
    const places = await googleNearbyPharmacies(this.config.get('GOOGLE_MAPS_API_KEY', { infer: true }), lat, lng, radiusKm * 1000);
    return places
      .map((pl) => mapGooglePlace(pl, pl.location ? haversineKm(lat, lng, pl.location.latitude, pl.location.longitude) : null))
      .filter((p): p is PharmacySummary => !!p);
  }
}
