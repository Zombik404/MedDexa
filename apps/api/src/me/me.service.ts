import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ComparisonHistoryView,
  FavoriteView,
  NotificationView,
  PreferencesInput,
  PreferencesView,
  SearchHistoryView,
} from '@meddexa/shared';
import type { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { MedicinesService } from '../medicines/medicines.service';
import { PharmaciesService } from '../pharmacies/pharmacies.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly medicines: MedicinesService,
    private readonly pharmacies: PharmaciesService,
  ) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { user: this.auth.toAuthUser(user), preferences: await this.preferences(userId) };
  }

  async updateProfile(userId: string, data: { displayName?: string | null }) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { displayName: data.displayName } });
    return this.auth.toAuthUser(user);
  }

  async preferences(userId: string): Promise<PreferencesView> {
    const p = await this.prisma.userPreferences.upsert({ where: { userId }, update: {}, create: { userId } });
    return {
      language: p.language,
      currency: p.currency,
      countryCode: p.countryCode,
      theme: p.theme as PreferencesView['theme'],
      notifyPriceChanges: p.notifyPriceChanges,
      notifyProductUpdates: p.notifyProductUpdates,
      analyticsConsent: p.analyticsConsent,
      saveSearchHistory: p.saveSearchHistory,
    };
  }

  async updatePreferences(userId: string, input: PreferencesInput): Promise<PreferencesView> {
    await this.prisma.userPreferences.upsert({ where: { userId }, update: input, create: { userId, ...input } });
    if (input.saveSearchHistory === false) await this.prisma.searchHistory.deleteMany({ where: { userId } });
    return this.preferences(userId);
  }

  async favorites(userId: string, currency: string): Promise<FavoriteView[]> {
    const rows = await this.prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const meds = await this.medicines.summaries(rows.filter((r) => r.medicineId).map((r) => r.medicineId!), currency);
    const phs = await this.pharmacies.summariesByIds(rows.filter((r) => r.pharmacyId).map((r) => r.pharmacyId!));
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      medicine: meds.find((m) => m.id === r.medicineId) ?? null,
      pharmacy: phs.find((p) => p.id === r.pharmacyId) ?? null,
    }));
  }

  async addFavorite(userId: string, input: { medicineId?: string; pharmacyId?: string }) {
    const existing = await this.prisma.favorite.findFirst({ where: { userId, medicineId: input.medicineId ?? null, pharmacyId: input.pharmacyId ?? null } });
    if (existing) return { id: existing.id };
    const f = await this.prisma.favorite.create({ data: { userId, medicineId: input.medicineId, pharmacyId: input.pharmacyId } });
    return { id: f.id };
  }

  async removeFavorite(userId: string, id: string) {
    const res = await this.prisma.favorite.deleteMany({ where: { id, userId } });
    if (!res.count) throw new NotFoundException({ message: 'Favorite not found', code: 'NOT_FOUND' });
  }

  async removeFavoriteByTarget(userId: string, input: { medicineId?: string; pharmacyId?: string }) {
    await this.prisma.favorite.deleteMany({ where: { userId, medicineId: input.medicineId, pharmacyId: input.pharmacyId } });
  }

  async searchHistory(userId: string): Promise<SearchHistoryView[]> {
    const rows = await this.prisma.searchHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((r) => ({
      id: r.id,
      query: r.query,
      filters: (r.filters as Record<string, unknown> | null) ?? null,
      resultCount: r.resultCount,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async clearSearchHistory(userId: string, id?: string) {
    await this.prisma.searchHistory.deleteMany({ where: { userId, ...(id ? { id } : {}) } });
  }

  async comparisons(userId: string): Promise<ComparisonHistoryView[]> {
    const rows = await this.prisma.comparisonHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    const ids = [...new Set(rows.flatMap((r) => r.medicineIds))];
    const names = new Map((await this.prisma.medicine.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((m) => [m.id, m.name]));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      medicineIds: r.medicineIds,
      medicineNames: r.medicineIds.map((id) => names.get(id) ?? '—'),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async saveComparison(userId: string, medicineIds: string[], title?: string) {
    const c = await this.prisma.comparisonHistory.create({ data: { userId, medicineIds, title } });
    return { id: c.id };
  }

  async deleteComparison(userId: string, id?: string) {
    await this.prisma.comparisonHistory.deleteMany({ where: { userId, ...(id ? { id } : {}) } });
  }

  async recentlyViewed(userId: string, currency: string) {
    const rows = await this.prisma.recentlyViewed.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, take: 30 });
    const meds = await this.medicines.summaries(rows.filter((r) => r.medicineId).map((r) => r.medicineId!), currency);
    const phs = await this.pharmacies.summariesByIds(rows.filter((r) => r.pharmacyId).map((r) => r.pharmacyId!));
    return { medicines: meds, pharmacies: phs };
  }

  async clearRecentlyViewed(userId: string) {
    await this.prisma.recentlyViewed.deleteMany({ where: { userId } });
  }

  async notifications(userId: string): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }));
  }

  async markNotificationsRead(userId: string, ids?: string[]) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  }

  async registerPushToken(userId: string, token: string, platform: string) {
    await this.prisma.pushToken.upsert({ where: { token }, update: { userId, platform }, create: { userId, token, platform } });
  }

  /** GDPR Art. 15/20: everything we hold about the user, machine-readable. */
  async export(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        preferences: true,
        favorites: true,
        searchHistory: true,
        comparisonHistory: true,
        recentlyViewed: true,
        notifications: true,
        reviews: true,
        reviewVotes: true,
        reports: true,
        sessions: { select: { id: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true } },
        pushTokens: { select: { platform: true, createdAt: true } },
      },
    });
    const { passwordHash: _omit, ...rest } = user;
    return {
      exportedAt: new Date().toISOString(),
      format: 'meddexa-user-export/v1',
      notice: 'MedDexa does not store user ids, IP addresses or device ids in analytics.',
      data: rest,
    };
  }

  /** GDPR Art. 17: deletes the account and all personal data (cascades). */
  async deleteAccount(userId: string, password: string) {
    if (!(await this.auth.verifyPassword(userId, password))) {
      throw new ForbiddenException({ message: 'Password is incorrect', code: 'INVALID_PASSWORD' });
    }
    await this.prisma.$transaction([
      this.prisma.auditLog.create({ data: { actorId: null, action: 'user.deleted', entityType: 'User', entityId: userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ] as Prisma.PrismaPromise<unknown>[]);
  }
}
