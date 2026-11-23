import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Paged, PharmacyDetail, PharmacySummary } from '@meddexa/shared';
import { createApp } from './app';

describe('Pharmacy discovery', () => {
  let app: INestApplication;
  const find = async (query: Record<string, string>) =>
    (await request(app.getHttpServer()).get('/v1/pharmacies').query(query).expect(200)).body as Paged<PharmacySummary>;

  beforeAll(async () => (app = await createApp()));
  afterAll(() => app.close());

  it('finds nearby pharmacies sorted by distance', async () => {
    const r = await find({ lat: '47.4979', lng: '19.0402', radiusKm: '5' });
    expect(r.items.length).toBe(4);
    const d = r.items.map((p) => p.distanceKm!);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(r.items.every((p) => p.countryCode === 'HU' && p.distanceKm! <= 5)).toBe(true);
  });

  it('searches by city, postcode, address and country', async () => {
    expect((await find({ city: 'wien' })).total).toBe(2);
    expect((await find({ postcode: '1061' })).items[0]!.name).toBe('Demo Pharmacy Andrássy');
    expect((await find({ q: 'Kastanienallee' })).items[0]!.city).toBe('Berlin');
    expect((await find({ country: 'CZ' })).total).toBe(2);
  });

  it('filters by services and verification', async () => {
    const r = await find({ services: 'NIGHT_SERVICE' });
    expect(r.total).toBeGreaterThan(0);
    expect((await find({ verifiedOnly: 'true' })).total).toBe(0); // demo data is never "verified"
  });

  it('supports the open-now filter', async () => {
    const r = await find({ openNow: 'true', pageSize: '50' });
    expect(r.items.every((p) => p.openNow === true)).toBe(true);
  });

  it('returns a profile that withholds unverified contact actions', async () => {
    const list = await find({ city: 'budapest' });
    const res = await request(app.getHttpServer()).get(`/v1/pharmacies/${list.items[0]!.id}`).query({ lat: '47.5', lng: '19.05' }).expect(200);
    const p = res.body as PharmacyDetail;
    expect(p.websiteVerified).toBe(false);
    expect(p.phone).toBeNull();
    expect(p.openingHours.length).toBeGreaterThan(0);
    expect(p.distanceKm).not.toBeNull();
    expect(p.provenance.isDemo).toBe(true);
  });

  it('reports Google Places as not configured instead of failing silently', async () => {
    const res = await request(app.getHttpServer()).get('/v1/pharmacies/external/google').query({ lat: '47.5', lng: '19.05' }).expect(503);
    expect(res.body.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
});
