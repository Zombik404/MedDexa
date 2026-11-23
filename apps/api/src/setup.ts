import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Env } from './config/env';

/** Shared HTTP setup for the server and for e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }).split(',').map((s) => s.trim()),
    credentials: false,
  });
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const doc = new DocumentBuilder()
    .setTitle('MedDexa API')
    .setDescription(
      'MedDexa — Smarter Healthcare. Across Europe.\n\nInformational medicine and pharmacy comparison API. There are no commerce endpoints: no carts, orders, payments, reservations or deliveries. Information is educational and does not replace professional medical advice.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addServer('/')
    .build();
  return SwaggerModule.createDocument(app, doc);
}
