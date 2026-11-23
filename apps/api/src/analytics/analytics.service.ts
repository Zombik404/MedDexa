import { Injectable, Logger } from '@nestjs/common';
import type { AnalyticsEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Anonymous product analytics. Stores no user id, IP or device id, so it does not need
 * consent under GDPR data minimisation; queries are truncated to 80 characters.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(private readonly prisma: PrismaService) {}

  record(type: AnalyticsEventType, data: { query?: string; entityId?: string; countryCode?: string; resultCount?: number } = {}) {
    void this.prisma.analyticsEvent
      .create({ data: { type, query: data.query?.slice(0, 80), entityId: data.entityId, countryCode: data.countryCode, resultCount: data.resultCount } })
      .catch((e: Error) => this.logger.warn(`analytics write failed: ${e.message}`));
  }
}
