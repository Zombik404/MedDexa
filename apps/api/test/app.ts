import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

let counter = 0;
export async function registerUser(app: INestApplication, overrides: Record<string, unknown> = {}) {
  counter++;
  const email = `user${Date.now()}${counter}@example.com`;
  const res = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({ email, password: 'Correct-Horse-9', displayName: 'Test User', acceptTerms: true, ...overrides })
    .expect(201);
  return { email, ...res.body } as { email: string; accessToken: string; refreshToken: string; user: { id: string } };
}

export async function login(app: INestApplication, email: string, password: string) {
  const res = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password }).expect(200);
  return res.body as { accessToken: string; refreshToken: string };
}
