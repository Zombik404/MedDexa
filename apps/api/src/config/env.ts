import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:8081'),
  PUBLIC_APP_URL: z.string().default('meddexa://'),
  SENTRY_DSN: z.string().optional(),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('MedDexa <no-reply@meddexa.app>'),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  /** Price records older than this are labelled outdated. */
  PRICE_STALE_DAYS: z.coerce.number().default(30),
  ENABLE_SCHEDULER: bool.default('true'),
  /** Expose demonstration data through the API (never in production). */
  ALLOW_DEMO_DATA: bool.default('true'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(120),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.ALLOW_DEMO_DATA) {
    throw new Error('ALLOW_DEMO_DATA must be false in production');
  }
  return parsed.data;
}
