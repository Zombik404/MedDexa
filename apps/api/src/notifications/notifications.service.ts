import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/**
 * In-app notifications plus push delivery through the Expo Push Service, which delivers
 * to FCM (Android) and APNs (iOS) using the credentials configured in EAS.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async notify(userId: string, n: { type: string; title: string; body: string; data?: Record<string, unknown> }) {
    await this.prisma.notification.create({ data: { userId, type: n.type, title: n.title, body: n.body, data: n.data as object } });
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (!tokens.length || this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.get('EXPO_ACCESS_TOKEN', { infer: true }) ? { Authorization: `Bearer ${this.config.get('EXPO_ACCESS_TOKEN', { infer: true })}` } : {}),
        },
        body: JSON.stringify(tokens.map((t) => ({ to: t.token, title: n.title, body: n.body, data: n.data }))),
      });
      if (!res.ok) this.logger.warn(`Push send responded ${res.status}`);
    } catch (e) {
      this.logger.warn(`Push send failed: ${(e as Error).message}`);
    }
  }

  /**
   * Daily: tell users who favourited a medicine and opted in when a verified price for it
   * changed in the last day. Demo data never triggers notifications.
   */
  @Cron('0 8 * * *', { timeZone: 'Europe/Berlin' })
  async priceChangeDigest() {
    if (!this.config.get('ENABLE_SCHEDULER', { infer: true }) || this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    const since = new Date(Date.now() - 86_400_000);
    const changed = await this.prisma.priceSnapshot.findMany({
      where: { capturedAt: { gte: since }, offer: { isDemo: false } },
      select: { offer: { select: { package: { select: { medicineId: true, medicine: { select: { name: true } } } } } } },
    });
    const medicines = new Map(changed.map((c) => [c.offer.package.medicineId, c.offer.package.medicine.name]));
    for (const [medicineId, name] of medicines) {
      const favs = await this.prisma.favorite.findMany({ where: { medicineId, user: { preferences: { notifyPriceChanges: true } } } });
      for (const f of favs) {
        await this.notify(f.userId, { type: 'PRICE_CHANGE', title: 'Price update', body: `New price information is available for ${name}.`, data: { medicineId } });
      }
    }
  }
}
