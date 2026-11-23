/** CLI: pnpm --filter @meddexa/api sync <sourceId> — runs one provider sync. */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SyncService } from '../src/integrations/sync.service';

async function main() {
  const sourceId = process.argv[2];
  if (!sourceId) throw new Error('Usage: pnpm sync <sourceId>');
  process.env.ENABLE_SCHEDULER = 'false';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const result = await app.get(SyncService).run(sourceId, 'cli');
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}
void main();
