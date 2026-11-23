/**
 * Recreates the test database schema from the committed migrations and seeds reference +
 * demo data. Applies migration SQL directly (same SQL `prisma migrate deploy` runs) so the
 * tests need nothing but PostgreSQL.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:5432/meddexa_test';
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  const dir = join(__dirname, '..', 'prisma', 'migrations');
  for (const m of readdirSync(dir).filter((d) => /^\d+_/.test(d)).sort()) {
    await client.query(readFileSync(join(dir, m, 'migration.sql'), 'utf8'));
  }
  await client.end();
  execSync('npx ts-node --transpile-only prisma/seed.ts', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url, SEED_DEMO: 'true', NODE_ENV: 'test', ADMIN_EMAIL: 'admin@test.local', ADMIN_PASSWORD: 'Admin-Password-123' },
    stdio: 'pipe',
  });
}
