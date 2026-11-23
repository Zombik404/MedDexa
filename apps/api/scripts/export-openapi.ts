/** Writes docs/openapi.json from the running module graph (no server needed). */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { buildOpenApi, configureApp } from '../src/setup';

async function main() {
  process.env.ENABLE_SCHEDULER = 'false';
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const doc = buildOpenApi(app);
  const out = join(__dirname, '..', '..', '..', 'docs', 'openapi.json');
  mkdirSync(join(out, '..'), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 2));
  console.log(`OpenAPI written to ${out} (${Object.keys(doc.paths).length} paths)`);
  await app.close();
}
void main();
