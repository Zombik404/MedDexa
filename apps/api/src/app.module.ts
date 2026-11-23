import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { CompareModule } from './compare/compare.module';
import { validateEnv, type Env } from './config/env';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MeModule } from './me/me.module';
import { MedicinesModule } from './medicines/medicines.module';
import { MetaModule } from './meta/meta.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PharmaciesModule } from './pharmacies/pharmacies.module';
import { PricesModule } from './prices/prices.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('NODE_ENV', { infer: true }) === 'test' ? 'silent' : 'info',
          transport: config.get('NODE_ENV', { infer: true }) === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
          // Never log credentials or tokens.
          redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.refreshToken', 'req.body.token'],
          autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/v1/health') },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [{ name: 'default', ttl: 60_000, limit: config.get('RATE_LIMIT_PER_MINUTE', { infer: true }) }],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    AnalyticsModule,
    PricesModule,
    NotificationsModule,
    AuthModule,
    MetaModule,
    MedicinesModule,
    CompareModule,
    PharmaciesModule,
    ReviewsModule,
    MeModule,
    IntegrationsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
