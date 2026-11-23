import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { MARKETS, normalizeText } from '@meddexa/shared';
import type { z } from 'zod';
import { AuditService } from '../common/audit.service';
import { CacheService } from '../common/cache.service';
import { ClientIp, CurrentUser, Roles, type RequestUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import type { Env } from '../config/env';
import { ADAPTERS, PLANNED_INTEGRATIONS } from '../integrations/registry';
import { SyncService } from '../integrations/sync.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  adminListSchema,
  availabilitySchema,
  hoursSchema,
  pharmacyUpsertSchema,
  priceUpdateSchema,
  reportResolutionSchema,
  reviewModerationSchema,
  servicesSchema,
  sourceUpdateSchema,
  userUpdateSchema,
  type AdminListQuery,
} from './admin.schemas';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminOpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sync: SyncService,
    private readonly cache: CacheService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get staleBefore() {
    return new Date(Date.now() - this.config.get('PRICE_STALE_DAYS', { infer: true }) * 86_400_000);
  }

  // ───────── Overview ─────────

  @Get('overview')
  @Roles('MODERATOR', 'EDITOR', 'ADMIN')
  async overview() {
    const [medicines, pharmacies, prices, stalePrices, pendingReviews, openReports, users, sources, failedSyncs] = await Promise.all([
      this.prisma.medicine.count({ where: { status: 'ACTIVE' } }),
      this.prisma.pharmacy.count({ where: { status: 'ACTIVE' } }),
      this.prisma.price.count(),
      this.prisma.price.count({ where: { OR: [{ observedAt: { lt: this.staleBefore } }, { verification: 'OUTDATED' }] } }),
      this.prisma.review.count({ where: { status: 'PENDING' } }),
      this.prisma.reviewReport.count({ where: { status: 'OPEN' } }),
      this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.dataSource.findMany({ select: { id: true, name: true, enabled: true, lastStatus: true, lastSyncAt: true, isDemo: true } }),
      this.prisma.dataSynchronizationLog.count({ where: { status: 'FAILED', startedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    ]);
    return { medicines, pharmacies, prices, stalePrices, pendingReviews, openReports, users, sources, failedSyncs };
  }

  // ───────── Pharmacies ─────────

  @Get('pharmacies')
  @Roles('EDITOR', 'ADMIN')
  async pharmacies(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    const where: Prisma.PharmacyWhereInput = {
      ...(q.q ? { OR: [{ normalizedName: { contains: normalizeText(q.q) } }, { city: { contains: q.q, mode: 'insensitive' } }, { postcode: { startsWith: q.q } }] } : {}),
      ...(q.country ? { countryCode: q.country } : {}),
      ...(q.status ? { verification: q.status as Prisma.EnumVerificationFilter['equals'] } : {}),
      ...(q.demo ? { isDemo: q.demo === 'true' } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.pharmacy.findMany({ where, include: { source: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.pharmacy.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('pharmacies/:id')
  @Roles('EDITOR', 'ADMIN')
  async pharmacy(@Param('id') id: string) {
    const p = await this.prisma.pharmacy.findUnique({ where: { id }, include: { openingHours: true, services: true, source: true } });
    if (!p) throw new NotFoundException('Pharmacy not found');
    return p;
  }

  @Post('pharmacies')
  @Roles('EDITOR', 'ADMIN')
  async createPharmacy(@Body(new ZodPipe(pharmacyUpsertSchema)) body: z.infer<typeof pharmacyUpsertSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const p = await this.prisma.pharmacy.create({ data: { ...body, normalizedName: normalizeText(body.name), verification: body.verification ?? 'UNVERIFIED' } });
    await this.audit.log({ actorId: user.id, action: 'pharmacy.create', entityType: 'Pharmacy', entityId: p.id, after: body, ip });
    return p;
  }

  @Patch('pharmacies/:id')
  @Roles('EDITOR', 'ADMIN')
  async updatePharmacy(@Param('id') id: string, @Body(new ZodPipe(pharmacyUpsertSchema.partial())) body: Partial<z.infer<typeof pharmacyUpsertSchema>>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const before = await this.prisma.pharmacy.findUniqueOrThrow({ where: { id } });
    const p = await this.prisma.pharmacy.update({ where: { id }, data: { ...body, ...(body.name ? { normalizedName: normalizeText(body.name) } : {}) } });
    await this.audit.log({ actorId: user.id, action: 'pharmacy.update', entityType: 'Pharmacy', entityId: id, before, after: body, ip });
    return p;
  }

  @Put('pharmacies/:id/hours')
  @Roles('EDITOR', 'ADMIN')
  async setHours(@Param('id') id: string, @Body(new ZodPipe(hoursSchema)) body: z.infer<typeof hoursSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    await this.prisma.$transaction([
      this.prisma.openingHours.deleteMany({ where: { pharmacyId: id } }),
      this.prisma.openingHours.createMany({ data: body.hours.map((h) => ({ ...h, pharmacyId: id })) }),
    ]);
    await this.audit.log({ actorId: user.id, action: 'pharmacy.hours', entityType: 'Pharmacy', entityId: id, after: body.hours, ip });
    return this.pharmacy(id);
  }

  @Put('pharmacies/:id/services')
  @Roles('EDITOR', 'ADMIN')
  async setServices(@Param('id') id: string, @Body(new ZodPipe(servicesSchema)) body: z.infer<typeof servicesSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    await this.prisma.$transaction([
      this.prisma.pharmacyServiceLink.deleteMany({ where: { pharmacyId: id } }),
      this.prisma.pharmacyServiceLink.createMany({ data: body.services.map((serviceCode) => ({ pharmacyId: id, serviceCode })) }),
    ]);
    await this.audit.log({ actorId: user.id, action: 'pharmacy.services', entityType: 'Pharmacy', entityId: id, after: body.services, ip });
    return this.pharmacy(id);
  }

  // ───────── Prices & availability ─────────

  @Get('prices')
  @Roles('EDITOR', 'ADMIN')
  async prices(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    const where: Prisma.PriceWhereInput = {
      ...(q.stale === 'true' ? { OR: [{ observedAt: { lt: this.staleBefore } }, { verification: 'OUTDATED' }] } : {}),
      offer: {
        ...(q.country ? { countryCode: q.country } : {}),
        ...(q.sourceId ? { sourceId: q.sourceId } : {}),
        ...(q.q ? { package: { medicine: { normalizedName: { contains: normalizeText(q.q) } } } } : {}),
      },
    };
    const [items, total] = await Promise.all([
      this.prisma.price.findMany({
        where,
        include: { offer: { include: { package: { include: { medicine: { select: { id: true, name: true } } } }, pharmacy: { select: { id: true, name: true, city: true } }, source: { select: { id: true, name: true } } } } },
        orderBy: { observedAt: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.price.count({ where }),
    ]);
    const staleBefore = this.staleBefore;
    return { items: items.map((p) => ({ ...p, stale: p.verification === 'OUTDATED' || p.observedAt < staleBefore })), total, page: q.page, pageSize: q.pageSize };
  }

  @Patch('prices/:id')
  @Roles('EDITOR', 'ADMIN')
  async updatePrice(@Param('id') id: string, @Body(new ZodPipe(priceUpdateSchema)) body: z.infer<typeof priceUpdateSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const before = await this.prisma.price.findUniqueOrThrow({ where: { id } });
    const observedAt = body.observedAt ?? new Date();
    const [price] = await this.prisma.$transaction([
      this.prisma.price.update({ where: { id }, data: { amount: body.amount, currency: body.currency, observedAt, verification: body.verification, ...(body.priceType ? { priceType: body.priceType } : {}) } }),
      this.prisma.priceSnapshot.upsert({
        where: { offerId_capturedAt: { offerId: before.offerId, capturedAt: observedAt } },
        update: { amount: body.amount, currency: body.currency },
        create: { offerId: before.offerId, amount: body.amount, currency: body.currency, capturedAt: observedAt },
      }),
    ]);
    await this.audit.log({ actorId: user.id, action: 'price.update', entityType: 'Price', entityId: id, before, after: body, ip });
    return price;
  }

  @Get('offers/:offerId/history')
  @Roles('EDITOR', 'ADMIN')
  history(@Param('offerId') offerId: string) {
    return this.prisma.priceSnapshot.findMany({ where: { offerId }, orderBy: { capturedAt: 'asc' } });
  }

  @Post('prices/mark-stale')
  @Roles('EDITOR', 'ADMIN')
  async markStale(@CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const res = await this.prisma.price.updateMany({ where: { observedAt: { lt: this.staleBefore }, verification: 'VERIFIED' }, data: { verification: 'OUTDATED' } });
    await this.audit.log({ actorId: user.id, action: 'price.mark-stale', entityType: 'Price', after: { count: res.count }, ip });
    return { updated: res.count };
  }

  @Get('availability')
  @Roles('EDITOR', 'ADMIN')
  async availability(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    const where: Prisma.AvailabilityRecordWhereInput = {
      ...(q.status ? { status: q.status as Prisma.EnumAvailabilityStatusFilter['equals'] } : {}),
      ...(q.stale === 'true' ? { observedAt: { lt: this.staleBefore } } : {}),
      ...(q.sourceId ? { sourceId: q.sourceId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.availabilityRecord.findMany({
        where,
        include: { offer: { include: { package: { include: { medicine: { select: { name: true } } } }, pharmacy: { select: { name: true, city: true } } } }, source: { select: { name: true } } },
        orderBy: { observedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.availabilityRecord.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Post('availability')
  @Roles('EDITOR', 'ADMIN')
  async recordAvailability(@Body(new ZodPipe(availabilitySchema)) body: z.infer<typeof availabilitySchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const source = await this.prisma.dataSource.findUnique({ where: { id: body.sourceId } });
    if (!source) throw new BadRequestException('Unknown data source');
    const rec = await this.prisma.availabilityRecord.create({ data: { offerId: body.offerId, status: body.status, sourceId: body.sourceId, observedAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: 'availability.create', entityType: 'AvailabilityRecord', entityId: rec.id, after: body, ip });
    return rec;
  }

  // ───────── Reviews ─────────

  @Get('reviews')
  @Roles('MODERATOR', 'ADMIN')
  async reviews(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    const where: Prisma.ReviewWhereInput = { ...(q.status ? { status: q.status as Prisma.EnumReviewStatusFilter['equals'] } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { author: { select: { id: true, email: true, displayName: true } }, medicine: { select: { id: true, name: true } }, pharmacy: { select: { id: true, name: true } }, _count: { select: { reports: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Patch('reviews/:id')
  @Roles('MODERATOR', 'ADMIN')
  async moderate(@Param('id') id: string, @Body(new ZodPipe(reviewModerationSchema)) body: z.infer<typeof reviewModerationSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const before = await this.prisma.review.findUniqueOrThrow({ where: { id } });
    const r = await this.prisma.review.update({ where: { id }, data: { status: body.status, moderationNote: body.note ?? before.moderationNote, moderatedById: user.id, moderatedAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: `review.${body.status.toLowerCase()}`, entityType: 'Review', entityId: id, before: { status: before.status }, after: body, ip });
    return r;
  }

  @Get('reports')
  @Roles('MODERATOR', 'ADMIN')
  reports(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    return this.prisma.reviewReport.findMany({
      where: { status: (q.status as Prisma.EnumReportStatusFilter['equals']) ?? 'OPEN' },
      include: { review: true, reporter: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
    });
  }

  @Patch('reports/:id')
  @Roles('MODERATOR', 'ADMIN')
  async resolveReport(@Param('id') id: string, @Body(new ZodPipe(reportResolutionSchema)) body: z.infer<typeof reportResolutionSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const report = await this.prisma.reviewReport.update({ where: { id }, data: { status: body.status, resolvedById: user.id, resolvedAt: new Date() } });
    if (body.removeReview) {
      await this.prisma.review.update({ where: { id: report.reviewId }, data: { status: 'REMOVED', moderatedById: user.id, moderatedAt: new Date() } });
    } else if (body.status === 'DISMISSED') {
      const stillOpen = await this.prisma.reviewReport.count({ where: { reviewId: report.reviewId, status: 'OPEN' } });
      const review = await this.prisma.review.findUniqueOrThrow({ where: { id: report.reviewId } });
      if (!stillOpen && review.status === 'PENDING' && review.moderationNote?.includes('reports')) {
        await this.prisma.review.update({ where: { id: review.id }, data: { status: 'PUBLISHED' } });
      }
    }
    await this.audit.log({ actorId: user.id, action: 'report.resolve', entityType: 'ReviewReport', entityId: id, after: body, ip });
    return report;
  }

  // ───────── Users ─────────

  @Get('users')
  @Roles('ADMIN')
  async users(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    const where: Prisma.UserWhereInput = {
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { displayName: { contains: q.q, mode: 'insensitive' } }] } : {}),
      ...(q.status ? { status: q.status as Prisma.EnumUserStatusFilter['equals'] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, email: true, displayName: true, role: true, status: true, createdAt: true, lastLoginAt: true, _count: { select: { reviews: true, reports: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Patch('users/:id')
  @Roles('ADMIN')
  async updateUser(@Param('id') id: string, @Body(new ZodPipe(userUpdateSchema)) body: z.infer<typeof userUpdateSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    if (id === user.id && (body.role && body.role !== 'ADMIN' || body.status === 'SUSPENDED')) {
      throw new BadRequestException('You cannot demote or suspend your own account');
    }
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: { role: true, status: true } });
    const u = await this.prisma.user.update({ where: { id }, data: body, select: { id: true, email: true, role: true, status: true } });
    if (body.status === 'SUSPENDED') await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: 'user.update', entityType: 'User', entityId: id, before, after: body, ip });
    return u;
  }

  /** Administrative activity of a user (audit trail). Personal browsing data is never exposed here. */
  @Get('users/:id/activity')
  @Roles('ADMIN')
  activity(@Param('id') id: string) {
    return this.prisma.auditLog.findMany({ where: { OR: [{ actorId: id }, { entityType: 'User', entityId: id }] }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  // ───────── Integrations ─────────

  @Get('integrations')
  @Roles('EDITOR', 'ADMIN')
  async integrations() {
    const sources = await this.prisma.dataSource.findMany({
      orderBy: { name: 'asc' },
      include: { syncLogs: { orderBy: { startedAt: 'desc' }, take: 5 }, _count: { select: { medicines: true, pharmacies: true, offers: true } } },
    });
    return Promise.all(sources.map(async (s) => ({ ...s, readiness: await this.sync.readiness(s.id), adapterRegistered: !!ADAPTERS[s.adapter] })));
  }

  @Patch('integrations/:id')
  @Roles('ADMIN')
  async updateSource(@Param('id') id: string, @Body(new ZodPipe(sourceUpdateSchema)) body: z.infer<typeof sourceUpdateSchema>, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    const before = await this.prisma.dataSource.findUniqueOrThrow({ where: { id } });
    const s = await this.prisma.dataSource.update({ where: { id }, data: { ...body, config: body.config as Prisma.InputJsonValue | undefined } });
    await this.cache.del('fx:');
    await this.audit.log({ actorId: user.id, action: 'integration.update', entityType: 'DataSource', entityId: id, before, after: body, ip });
    return s;
  }

  @Post('integrations/:id/sync')
  @Roles('EDITOR', 'ADMIN')
  async runSync(@Param('id') id: string, @CurrentUser() user: RequestUser, @ClientIp() ip: string | null) {
    await this.audit.log({ actorId: user.id, action: 'integration.sync', entityType: 'DataSource', entityId: id, ip });
    const result = await this.sync.run(id, `manual:${user.email}`);
    await this.cache.del('fx:');
    return result;
  }

  @Get('integrations/logs')
  @Roles('EDITOR', 'ADMIN')
  logs(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    return this.prisma.dataSynchronizationLog.findMany({
      where: { ...(q.sourceId ? { sourceId: q.sourceId } : {}), ...(q.status ? { status: q.status as Prisma.EnumSyncStatusFilter['equals'] } : {}) },
      orderBy: { startedAt: 'desc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
      include: { source: { select: { name: true } } },
    });
  }

  @Get('integrations/coverage')
  @Roles('EDITOR', 'ADMIN')
  async coverage() {
    const rows = await this.prisma.$queryRaw<{ code: string; name: string; supported: boolean; medicines: bigint; real_medicines: bigint; pharmacies: bigint; real_pharmacies: bigint; offers: bigint; sources: bigint }[]>(Prisma.sql`
      SELECT c.code, c.name, c.supported,
        (SELECT count(DISTINCT r."medicineId") FROM product_registrations r WHERE r."countryCode" = c.code) AS medicines,
        (SELECT count(DISTINCT r."medicineId") FROM product_registrations r JOIN medicines m ON m.id = r."medicineId" WHERE r."countryCode" = c.code AND NOT m."isDemo") AS real_medicines,
        (SELECT count(*) FROM pharmacies p WHERE p."countryCode" = c.code) AS pharmacies,
        (SELECT count(*) FROM pharmacies p WHERE p."countryCode" = c.code AND NOT p."isDemo") AS real_pharmacies,
        (SELECT count(*) FROM pharmacy_offers o WHERE o."countryCode" = c.code) AS offers,
        (SELECT count(*) FROM data_sources s WHERE s."countryCode" = c.code AND s.enabled) AS sources
      FROM countries c ORDER BY c.name`);
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      supported: r.supported,
      medicines: Number(r.medicines),
      realMedicines: Number(r.real_medicines),
      pharmacies: Number(r.pharmacies),
      realPharmacies: Number(r.real_pharmacies),
      offers: Number(r.offers),
      enabledSources: Number(r.sources),
      planned: PLANNED_INTEGRATIONS[r.code] ?? null,
      isTargetMarket: MARKETS.some((m) => m.code === r.code),
    }));
  }

  // ───────── Analytics & audit ─────────

  @Get('analytics')
  @Roles('EDITOR', 'ADMIN')
  async analytics(@Query('days') daysRaw?: string) {
    const days = Math.min(Math.max(Number(daysRaw) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86_400_000);
    const [perDay, topQueries, zeroResult, topMedicines, topCities, comparisons, syncHealth] = await Promise.all([
      this.prisma.$queryRaw<{ day: Date; type: string; count: bigint }[]>(Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS day, type::text, count(*) AS count FROM analytics_events
        WHERE "createdAt" >= ${since} AND type IN ('SEARCH', 'COMPARE', 'PHARMACY_SEARCH', 'VIEW_MEDICINE')
        GROUP BY 1, 2 ORDER BY 1`),
      this.prisma.analyticsEvent.groupBy({ by: ['query'], where: { type: 'SEARCH', createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { query: 'desc' } }, take: 15 }),
      this.prisma.analyticsEvent.groupBy({ by: ['query'], where: { type: 'SEARCH', createdAt: { gte: since }, resultCount: 0 }, _count: { _all: true }, orderBy: { _count: { query: 'desc' } }, take: 15 }),
      this.prisma.$queryRaw<{ id: string; name: string; views: bigint }[]>(Prisma.sql`
        SELECT m.id, m.name, count(*) AS views FROM analytics_events e JOIN medicines m ON m.id = e."entityId"
        WHERE e.type = 'VIEW_MEDICINE' AND e."createdAt" >= ${since} GROUP BY m.id, m.name ORDER BY views DESC LIMIT 15`),
      this.prisma.$queryRaw<{ city: string; country: string; views: bigint }[]>(Prisma.sql`
        SELECT p.city, p."countryCode" AS country, count(*) AS views FROM analytics_events e JOIN pharmacies p ON p.id = e."entityId"
        WHERE e.type = 'VIEW_PHARMACY' AND e."createdAt" >= ${since} AND p.city IS NOT NULL GROUP BY 1, 2 ORDER BY views DESC LIMIT 15`),
      this.prisma.analyticsEvent.count({ where: { type: 'COMPARE', createdAt: { gte: since } } }),
      this.prisma.dataSynchronizationLog.groupBy({ by: ['sourceId', 'status'], where: { startedAt: { gte: since } }, _count: { _all: true } }),
    ]);
    return {
      days,
      perDay: perDay.map((r) => ({ day: r.day.toISOString().slice(0, 10), type: r.type, count: Number(r.count) })),
      topQueries: topQueries.map((q) => ({ query: q.query, count: q._count._all })),
      zeroResultQueries: zeroResult.map((q) => ({ query: q.query, count: q._count._all })),
      topMedicines: topMedicines.map((m) => ({ id: m.id, name: m.name, views: Number(m.views) })),
      topPharmacyLocations: topCities.map((c) => ({ city: c.city, country: c.country, views: Number(c.views) })),
      comparisons,
      syncHealth: syncHealth.map((s) => ({ sourceId: s.sourceId, status: s.status, count: s._count._all })),
    };
  }

  @Get('audit-logs')
  @Roles('ADMIN')
  auditLogs(@Query(new ZodPipe(adminListSchema)) q: AdminListQuery) {
    return this.prisma.auditLog.findMany({
      where: { ...(q.entityType ? { entityType: q.entityType } : {}), ...(q.q ? { action: { contains: q.q } } : {}) },
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
    });
  }
}
