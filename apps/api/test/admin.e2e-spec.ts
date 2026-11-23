import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, login, registerUser } from './app';

describe('Administration', () => {
  let app: INestApplication;
  let admin: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createApp();
    admin = (await login(app, 'admin@test.local', 'Admin-Password-123')).accessToken;
  });
  afterAll(() => app.close());

  it('enforces role-based access', async () => {
    const u = await registerUser(app);
    await request(app.getHttpServer()).get('/v1/admin/overview').expect(401);
    await request(app.getHttpServer()).get('/v1/admin/overview').set(auth(u.accessToken)).expect(403);
    await request(app.getHttpServer()).get('/v1/admin/overview').set(auth(admin)).expect(200);
  });

  it('creates a medicine with exact ingredient quantities and audits it', async () => {
    const ing = await request(app.getHttpServer()).get('/v1/admin/ingredients').query({ q: 'ibuprofen' }).set(auth(admin)).expect(200);
    const ibuprofen = ing.body.find((i: { name: string }) => i.name === 'ibuprofen');
    const created = await request(app.getHttpServer())
      .post('/v1/admin/medicines').set(auth(admin))
      .send({ name: 'Editorial Ibuprofen 600 mg tablets', formCode: 'TABLET', route: 'ORAL', release: 'IMMEDIATE', prescription: 'RX', countryCode: 'HU' })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/v1/admin/medicines/${created.body.id}/ingredients`).set(auth(admin))
      .send({ ingredients: [{ ingredientId: ibuprofen.id, amount: 600, unit: 'mg' }] })
      .expect(200);
    await request(app.getHttpServer()).post(`/v1/admin/medicines/${created.body.id}/packages`).set(auth(admin)).send({ quantity: 30, unit: 'tablet', isDefault: true }).expect(201);
    const found = await request(app.getHttpServer()).get('/v1/medicines/search').query({ q: 'editorial', strength: '600 mg' }).expect(200);
    expect(found.body.items[0].id).toBe(created.body.id);
    const logs = await request(app.getHttpServer()).get('/v1/admin/audit-logs').query({ entityType: 'Medicine' }).set(auth(admin)).expect(200);
    expect(logs.body.map((l: { action: string }) => l.action)).toEqual(expect.arrayContaining(['medicine.create', 'medicine.ingredients']));
  });

  it('detects duplicate medicine records', async () => {
    const res = await request(app.getHttpServer()).get('/v1/admin/medicines/duplicates').set(auth(admin)).expect(200);
    expect(res.body.some((p: { aName: string; bName: string }) => [p.aName, p.bName].includes('IBUDEX 200MG FILMTABL.'))).toBe(true);
  });

  it('lists stale prices and updates a price with a history snapshot', async () => {
    const stale = await request(app.getHttpServer()).get('/v1/admin/prices').query({ stale: 'true' }).set(auth(admin)).expect(200);
    expect(stale.body.items.every((p: { stale: boolean }) => p.stale)).toBe(true);
    const price = stale.body.items[0];
    await request(app.getHttpServer()).patch(`/v1/admin/prices/${price.id}`).set(auth(admin)).send({ amount: 9.99, currency: price.currency, verification: 'VERIFIED' }).expect(200);
    const hist = await request(app.getHttpServer()).get(`/v1/admin/offers/${price.offerId}/history`).set(auth(admin)).expect(200);
    expect(hist.body.some((s: { amount: string }) => Number(s.amount) === 9.99)).toBe(true);
  });

  it('moderates pending reviews', async () => {
    const u = await registerUser(app);
    const med = (await request(app.getHttpServer()).get('/v1/medicines/search').query({ q: 'lordex' })).body.items[0];
    const r = await request(app.getHttpServer()).post(`/v1/medicines/${med.id}/reviews`).set(auth(u.accessToken))
      .send({ rating: 3, body: 'Contact me at someone@example.com for details about this.', language: 'en' }).expect(201);
    expect(r.body.status).toBe('PENDING');
    const pending = await request(app.getHttpServer()).get('/v1/admin/reviews').query({ status: 'PENDING' }).set(auth(admin)).expect(200);
    expect(pending.body.items.some((x: { id: string }) => x.id === r.body.id)).toBe(true);
    await request(app.getHttpServer()).patch(`/v1/admin/reviews/${r.body.id}`).set(auth(admin)).send({ status: 'REJECTED', note: 'personal data' }).expect(200);
  });

  it('manages users and prevents self-demotion', async () => {
    const u = await registerUser(app);
    await request(app.getHttpServer()).patch(`/v1/admin/users/${u.user.id}`).set(auth(admin)).send({ role: 'MODERATOR' }).expect(200);
    const mod = await login(app, u.email, 'Correct-Horse-9');
    await request(app.getHttpServer()).get('/v1/admin/reviews').set(auth(mod.accessToken)).expect(200);
    await request(app.getHttpServer()).get('/v1/admin/users').set(auth(mod.accessToken)).expect(403);
    const me = await request(app.getHttpServer()).get('/v1/me').set(auth(admin)).expect(200);
    await request(app.getHttpServer()).patch(`/v1/admin/users/${me.body.user.id}`).set(auth(admin)).send({ role: 'USER' }).expect(400);
  });

  it('reports integration readiness and logs sync outcomes', async () => {
    const list = await request(app.getHttpServer()).get('/v1/admin/integrations').set(auth(admin)).expect(200);
    const osm = list.body.find((s: { id: string }) => s.id === 'osm-overpass');
    expect(osm.readiness.missingConfig).toEqual(['countries']);
    const google = list.body.find((s: { id: string }) => s.id === 'google-places');
    expect(google.readiness.onDemandOnly).toBe(true);

    const demo = await request(app.getHttpServer()).post('/v1/admin/integrations/demo/sync').set(auth(admin)).expect(201);
    expect(demo.body.status).toBe('SUCCESS');
    const skipped = await request(app.getHttpServer()).post('/v1/admin/integrations/osm-overpass/sync').set(auth(admin)).expect(201);
    expect(skipped.body.status).toBe('SKIPPED');
    const logs = await request(app.getHttpServer()).get('/v1/admin/integrations/logs').set(auth(admin)).expect(200);
    expect(logs.body.map((l: { sourceId: string }) => l.sourceId)).toEqual(expect.arrayContaining(['demo', 'osm-overpass']));
    const coverage = await request(app.getHttpServer()).get('/v1/admin/integrations/coverage').set(auth(admin)).expect(200);
    const hu = coverage.body.find((c: { code: string }) => c.code === 'HU');
    expect(hu.realMedicines).toBe(0);
    expect(hu.planned).toMatch(/NEAK/);
  });

  it('returns analytics without personal identifiers', async () => {
    const res = await request(app.getHttpServer()).get('/v1/admin/analytics').set(auth(admin)).expect(200);
    expect(res.body.topQueries.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com/);
  });
});
