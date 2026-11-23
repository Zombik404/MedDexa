import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MailService } from '../src/mail/mail.service';
import { createApp, login, registerUser } from './app';

describe('Accounts, personal data and reviews', () => {
  let app: INestApplication;
  let medicineId: string;
  let otherMedicineId: string;
  let pharmacyId: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createApp();
    const meds = await request(app.getHttpServer()).get('/v1/medicines/search').query({ q: 'paradex', sort: 'name' });
    medicineId = meds.body.items[0].id;
    otherMedicineId = meds.body.items[1].id;
    const ph = await request(app.getHttpServer()).get('/v1/pharmacies').query({ city: 'budapest' });
    pharmacyId = ph.body.items[0].id;
  });
  afterAll(() => app.close());

  describe('authentication', () => {
    it('validates registration input', async () => {
      const res = await request(app.getHttpServer()).post('/v1/auth/register').send({ email: 'bad', password: 'short', acceptTerms: false }).expect(400);
      const paths = res.body.details.map((d: { path: string }) => d.path);
      expect(paths).toEqual(expect.arrayContaining(['email', 'password', 'acceptTerms']));
    });

    it('registers, rejects duplicates and logs in', async () => {
      const u = await registerUser(app);
      expect(u.accessToken).toBeTruthy();
      await request(app.getHttpServer()).post('/v1/auth/register').send({ email: u.email, password: 'Correct-Horse-9', acceptTerms: true }).expect(409);
      await request(app.getHttpServer()).post('/v1/auth/login').send({ email: u.email, password: 'wrong-password-1' }).expect(401);
      await request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'nobody@example.com', password: 'whatever-123' }).expect(401);
      await login(app, u.email, 'Correct-Horse-9');
    });

    it('rotates refresh tokens and detects reuse', async () => {
      const u = await registerUser(app);
      const r1 = await request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
      await request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
      // Reuse revoked the whole family, including the token issued by the rotation.
      await request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
    });

    it('protects personal endpoints and rejects bad tokens', async () => {
      await request(app.getHttpServer()).get('/v1/me').expect(401);
      await request(app.getHttpServer()).get('/v1/me').set(auth('not-a-token')).expect(401);
      // Public endpoints still work with a bad token (guest access).
      await request(app.getHttpServer()).get('/v1/meta').set(auth('not-a-token')).expect(200);
    });

    it('resets a password through an emailed link without revealing accounts', async () => {
      const u = await registerUser(app);
      await request(app.getHttpServer()).post('/v1/auth/forgot-password').send({ email: 'unknown@example.com' }).expect(202);
      await request(app.getHttpServer()).post('/v1/auth/forgot-password').send({ email: u.email }).expect(202);
      const mail = app.get(MailService).lastMessage!;
      expect(mail.to).toBe(u.email);
      const token = mail.text.match(/token=([\w-]+)/)![1]!;
      await request(app.getHttpServer()).post('/v1/auth/reset-password').send({ token, password: 'Brand-New-Pass-7' }).expect(204);
      await request(app.getHttpServer()).post('/v1/auth/reset-password').send({ token, password: 'Brand-New-Pass-8' }).expect(401);
      await login(app, u.email, 'Brand-New-Pass-7');
      // Existing sessions were revoked by the reset.
      await request(app.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    });
  });

  describe('personal data', () => {
    it('manages preferences, favorites, history and comparisons', async () => {
      const u = await registerUser(app);
      const h = auth(u.accessToken);
      const prefs = await request(app.getHttpServer()).patch('/v1/me/preferences').set(h).send({ language: 'hu', currency: 'HUF', theme: 'dark' }).expect(200);
      expect(prefs.body).toMatchObject({ language: 'hu', currency: 'HUF', theme: 'dark' });

      await request(app.getHttpServer()).post('/v1/me/favorites').set(h).send({ medicineId }).expect(201);
      await request(app.getHttpServer()).post('/v1/me/favorites').set(h).send({ medicineId }).expect(201); // idempotent
      await request(app.getHttpServer()).post('/v1/me/favorites').set(h).send({ pharmacyId }).expect(201);
      await request(app.getHttpServer()).post('/v1/me/favorites').set(h).send({ medicineId, pharmacyId }).expect(400);
      const favs = await request(app.getHttpServer()).get('/v1/me/favorites').set(h).query({ currency: 'HUF' }).expect(200);
      expect(favs.body).toHaveLength(2);
      await request(app.getHttpServer()).delete('/v1/me/favorites').set(h).query({ medicineId }).expect(204);
      expect((await request(app.getHttpServer()).get('/v1/me/favorites').set(h)).body).toHaveLength(1);

      await request(app.getHttpServer()).get('/v1/medicines/search').set(h).query({ q: 'ibudex' }).expect(200);
      const hist = await request(app.getHttpServer()).get('/v1/me/search-history').set(h).expect(200);
      expect(hist.body[0].query).toBe('ibudex');

      await request(app.getHttpServer()).post('/v1/compare').set(h).send({ medicineIds: [medicineId, otherMedicineId] }).expect(200);
      const comps = await request(app.getHttpServer()).get('/v1/me/comparisons').set(h).expect(200);
      expect(comps.body[0].medicineIds).toEqual([medicineId, otherMedicineId]);
      expect(comps.body[0].medicineNames).toHaveLength(2);

      await request(app.getHttpServer()).get(`/v1/medicines/${medicineId}`).set(h).expect(200);
      const recent = await request(app.getHttpServer()).get('/v1/me/recently-viewed').set(h).expect(200);
      expect(recent.body.medicines[0].id).toBe(medicineId);

      // Turning off search history deletes it.
      await request(app.getHttpServer()).patch('/v1/me/preferences').set(h).send({ saveSearchHistory: false }).expect(200);
      expect((await request(app.getHttpServer()).get('/v1/me/search-history').set(h)).body).toHaveLength(0);
      await request(app.getHttpServer()).get('/v1/medicines/search').set(h).query({ q: 'paradex' }).expect(200);
      expect((await request(app.getHttpServer()).get('/v1/me/search-history').set(h)).body).toHaveLength(0);
    });

    it('exports data without secrets and deletes the account', async () => {
      const u = await registerUser(app);
      const h = auth(u.accessToken);
      const exp = await request(app.getHttpServer()).get('/v1/me/export').set(h).expect(200);
      expect(exp.body.data.email).toBe(u.email);
      expect(JSON.stringify(exp.body)).not.toMatch(/passwordHash|tokenHash/);
      await request(app.getHttpServer()).post('/v1/me/delete').set(h).send({ password: 'wrong' }).expect(403);
      await request(app.getHttpServer()).post('/v1/me/delete').set(h).send({ password: 'Correct-Horse-9' }).expect(204);
      await request(app.getHttpServer()).post('/v1/auth/login').send({ email: u.email, password: 'Correct-Horse-9' }).expect(401);
    });
  });

  describe('reviews', () => {
    it('publishes clean reviews and holds risky ones for moderation', async () => {
      const u = await registerUser(app);
      const h = auth(u.accessToken);
      const ok = await request(app.getHttpServer())
        .post(`/v1/medicines/${medicineId}/reviews`).set(h)
        .send({ rating: 4, body: 'Easy to swallow and the leaflet was clear and complete.', language: 'en' }).expect(201);
      expect(ok.body.status).toBe('PUBLISHED');
      await request(app.getHttpServer())
        .post(`/v1/medicines/${medicineId}/reviews`).set(h)
        .send({ rating: 5, body: 'Posting a second review for the same product here.', language: 'en' }).expect(409);
      const held = await request(app.getHttpServer())
        .post(`/v1/medicines/${otherMedicineId}/reviews`).set(h)
        .send({ rating: 5, body: 'This cures everything, buy it at www.example.com today!', language: 'en' }).expect(201);
      expect(held.body.status).toBe('PENDING');
      const list = await request(app.getHttpServer()).get(`/v1/medicines/${medicineId}/reviews`).expect(200);
      expect(list.body.stats.count).toBe(1);
      expect(list.body.stats.distribution['4']).toBe(1);
      expect(list.body.items[0].authorName).toBe('Test U.');
      const pendingList = await request(app.getHttpServer()).get(`/v1/medicines/${otherMedicineId}/reviews`).expect(200);
      expect(pendingList.body.total).toBe(0);
    });

    it('supports pharmacy sub-ratings, helpful votes and reports', async () => {
      const author = await registerUser(app);
      const res = await request(app.getHttpServer())
        .post(`/v1/pharmacies/${pharmacyId}/reviews`).set(auth(author.accessToken))
        .send({ rating: 5, body: 'Friendly staff, short queue, very clean and accessible entrance.', language: 'en', staffRating: 5, waitingRating: 4, accessibilityRating: 5 })
        .expect(201);
      const reviewId = res.body.id;
      await request(app.getHttpServer()).post(`/v1/reviews/${reviewId}/helpful`).set(auth(author.accessToken)).expect(403);
      const voters = await Promise.all([registerUser(app), registerUser(app), registerUser(app)]);
      const v = await request(app.getHttpServer()).post(`/v1/reviews/${reviewId}/helpful`).set(auth(voters[0]!.accessToken)).expect(200);
      expect(v.body.voted).toBe(true);
      const detail = await request(app.getHttpServer()).get(`/v1/pharmacies/${pharmacyId}`).expect(200);
      expect(detail.body.ratingBreakdown.staff).toBe(5);
      for (const voter of voters) {
        await request(app.getHttpServer()).post(`/v1/reviews/${reviewId}/report`).set(auth(voter.accessToken)).send({ reason: 'OFF_TOPIC' }).expect(200);
      }
      const after = await request(app.getHttpServer()).get(`/v1/pharmacies/${pharmacyId}/reviews`).expect(200);
      expect(after.body.items.find((r: { id: string }) => r.id === reviewId)).toBeUndefined();
    });
  });
});
