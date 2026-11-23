import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { CompareResponse, MedicineDetail, MedicineSummary, Paged, PriceComparisonView } from '@meddexa/shared';
import { createApp } from './app';

describe('Catalogue, search, prices and comparison (guest)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const ids: Record<string, string> = {};

  const search = async (query: Record<string, string>) =>
    (await http.get('/v1/medicines/search').query(query).expect(200)).body as Paged<MedicineSummary>;

  beforeAll(async () => {
    app = await createApp();
    http = request(app.getHttpServer()) as unknown as ReturnType<typeof request>;
    const all = await search({ pageSize: '50' });
    for (const m of all.items) ids[m.name] = m.id;
  });
  afterAll(() => app.close());

  it('reports health', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body.checks.database).toBe(true);
  });

  it('has no commerce endpoints', async () => {
    for (const path of ['/v1/cart', '/v1/orders', '/v1/checkout', '/v1/payments', '/v1/reservations', '/v1/deliveries']) {
      await request(app.getHttpServer()).get(path).expect(404);
    }
  });

  it('searches by name and brand', async () => {
    const r = await search({ q: 'paradex' });
    expect(r.items.map((m) => m.name)).toEqual(expect.arrayContaining(['Paradex 500 mg tablets', 'Paradex Plus 500 mg/65 mg tablets']));
    expect(r.items.every((m) => m.isDemo)).toBe(true);
  });

  it('matches ingredient synonyms across languages', async () => {
    const r = await search({ q: 'acetaminophen' });
    expect(r.total).toBeGreaterThan(0);
    expect(r.items.every((m) => m.ingredients.some((i) => i.substanceName === 'paracetamol'))).toBe(true);
    const de = await search({ q: 'Coffein' });
    expect(de.items.some((m) => m.name.startsWith('Cefadex'))).toBe(true);
  });

  it('tolerates spelling variations', async () => {
    const r = await search({ q: 'ibuprofn' });
    expect(r.items.some((m) => m.name.includes('Ibudex'))).toBe(true);
  });

  it('finds localized registration names', async () => {
    const r = await search({ q: 'filmtabletta' });
    expect(r.items.some((m) => m.countryCode === 'HU')).toBe(true);
  });

  it('requires every listed ingredient (multi-ingredient search)', async () => {
    const r = await search({ ingredients: 'paracetamol,caffeine' });
    expect(r.items.map((m) => m.name).sort()).toEqual(['Cefadex 500 mg/65 mg film-coated tablets', 'Paradex Plus 500 mg/65 mg tablets']);
  });

  it('matches salts through their active moiety', async () => {
    const r = await search({ ingredients: 'ibuprofen' });
    expect(r.items.some((m) => m.name.startsWith('Lysiprofen'))).toBe(true);
  });

  it('filters by strength regardless of unit', async () => {
    const r = await search({ strength: '1 g' });
    expect(r.items.map((m) => m.name)).toContain('Paradex 1000 mg effervescent tablets');
    const mg = await search({ strength: '400mg', ingredients: 'ibuprofen' });
    expect(mg.items.every((m) => m.ingredients[0]!.amount === 400)).toBe(true);
  });

  it('filters by barcode, registration number, ATC, form, prescription and country', async () => {
    expect((await search({ barcode: '5990000000031' })).items.map((m) => m.name)).toEqual(['Ibudex 400 mg film-coated tablets']);
    expect((await search({ registrationNumber: 'demo-pl-20001' })).items.map((m) => m.name)).toEqual(['Profenil 400 mg tablets']);
    expect((await search({ atc: 'R06' })).total).toBe(2);
    expect((await search({ form: 'GEL' })).items.every((m) => m.form?.code === 'GEL')).toBe(true);
    expect((await search({ prescription: 'RX' })).items.every((m) => m.prescription === 'RX')).toBe(true);
    const at = await search({ country: 'AT' });
    expect(at.items.map((m) => m.name)).toEqual(expect.arrayContaining(['Profenil 400 mg tablets', 'Paradex 500 mg tablets', 'Ibudex 5% gel']));
  });

  it('paginates on the server', async () => {
    const p1 = await search({ pageSize: '5', page: '1', sort: 'name' });
    const p2 = await search({ pageSize: '5', page: '2', sort: 'name' });
    expect(p1.items).toHaveLength(5);
    expect(p1.hasMore).toBe(true);
    expect(p1.items.map((m) => m.id)).not.toEqual(expect.arrayContaining(p2.items.map((m) => m.id)));
    expect(p1.total).toBe(p2.total);
  });

  it('sorts by price in the requested currency', async () => {
    const r = await search({ sort: 'price_asc', currency: 'EUR', hasPrice: 'true', pageSize: '50' });
    const amounts = r.items.map((m) => m.lowestPrice!.amount);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
  });

  it('validates query parameters', async () => {
    const res = await request(app.getHttpServer()).get('/v1/medicines/search').query({ pageSize: '500' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    await request(app.getHttpServer()).get('/v1/medicines/search').query({ currency: 'XYZ' }).expect(400);
  });

  it('suggests medicines and ingredients', async () => {
    const res = await request(app.getHttpServer()).get('/v1/medicines/suggest').query({ q: 'para' }).expect(200);
    const types = new Set(res.body.map((s: { type: string }) => s.type));
    expect(types.has('medicine')).toBe(true);
    expect(types.has('ingredient')).toBe(true);
  });

  it('returns medicine details with provenance and safety sections', async () => {
    const res = await request(app.getHttpServer()).get(`/v1/medicines/${ids['Paradex 500 mg tablets']}`).expect(200);
    const d = res.body as MedicineDetail;
    expect(d.registrations.length).toBe(6);
    expect(d.provenance.isDemo).toBe(true);
    expect(d.safety.length).toBeGreaterThan(0);
    expect(d.safety[0]!.provenance.verification).toBe('DEMO');
    await request(app.getHttpServer()).get('/v1/medicines/does-not-exist').expect(404);
  });

  it('compares prices across countries with labelled conversions', async () => {
    const res = await request(app.getHttpServer()).get(`/v1/medicines/${ids['Paradex 500 mg tablets']}/prices`).query({ currency: 'HUF' }).expect(200);
    const p = res.body as PriceComparisonView;
    expect(new Set(p.offers.map((o) => o.countryCode)).size).toBeGreaterThanOrEqual(5);
    const eurOffer = p.offers.find((o) => o.local.currency === 'EUR')!;
    expect(eurOffer.converted?.currency).toBe('HUF');
    expect(eurOffer.converted?.rateSource).toMatch(/development fallback/);
    const hufOffer = p.offers.find((o) => o.local.currency === 'HUF')!;
    expect(hufOffer.converted).toBeNull();
    expect(p.countriesWithoutData).toEqual(expect.arrayContaining(['FR', 'ES']));
    expect(p.rates?.isFallback).toBe(true);
    expect(p.history.length).toBeGreaterThan(0);
    // Stale prices are listed after fresh ones and flagged.
    const firstStale = p.offers.findIndex((o) => o.stale);
    if (firstStale >= 0) expect(p.offers.slice(firstStale).every((o) => o.stale)).toBe(true);
  });

  it('compares a combination product against a single-ingredient product', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/compare')
      .send({ medicineIds: [ids['Paradex Plus 500 mg/65 mg tablets'], ids['Paradex 500 mg tablets']], currency: 'EUR' })
      .expect(200);
    const c = res.body as CompareResponse;
    expect(c.result.summary.composition).toBe('SIMILAR_COMPOSITION');
    expect(c.result.summary.assessment).toBe('IMPORTANT_DIFFERENCES');
    expect(c.result.pairs[0]!.differences[0]!.code).toBe('MISSING_INGREDIENT');
    expect(Object.keys(c.prices)).toHaveLength(2);
  });

  it('flags salts, forms and release mechanisms in comparison', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/compare')
      .send({ medicineIds: [ids['Ibudex 400 mg film-coated tablets'], ids['Profenil 400 mg tablets'], ids['Lysiprofen 684 mg film-coated tablets'], ids['Ibudex Retard 800 mg prolonged-release tablets']] })
      .expect(200);
    const [profenil, lysine, retard] = (res.body as CompareResponse).result.pairs;
    expect(profenil!.assessment).toBe('POTENTIALLY_EQUIVALENT');
    expect(profenil!.differences.map((d) => d.code)).toContain('FORM_VARIANT');
    expect(lysine!.differences.map((d) => d.code)).toContain('DIFFERENT_SALT');
    expect(retard!.differences.map((d) => d.code)).toEqual(expect.arrayContaining(['DIFFERENT_RELEASE', 'DIFFERENT_STRENGTH']));
  });

  it('rejects invalid comparisons', async () => {
    const id = ids['Paradex 500 mg tablets']!;
    await request(app.getHttpServer()).post('/v1/compare').send({ medicineIds: [id] }).expect(400);
    await request(app.getHttpServer()).post('/v1/compare').send({ medicineIds: [id, id] }).expect(400);
    await request(app.getHttpServer()).post('/v1/compare').send({ medicineIds: [id, 'missing'] }).expect(404);
  });

  it('lists similar products ranked by composition', async () => {
    const res = await request(app.getHttpServer()).get(`/v1/medicines/${ids['Paradex Plus 500 mg/65 mg tablets']}/similar`).expect(200);
    expect(res.body[0].composition).toBe('SAME_COMBINATION');
    expect(res.body[0].medicine.name).toMatch(/Cefadex/);
  });

  it('serves meta, categories and FX rates', async () => {
    const meta = await request(app.getHttpServer()).get('/v1/meta').expect(200);
    expect(meta.body.languages).toHaveLength(12);
    expect(meta.body.countries.length).toBeGreaterThanOrEqual(13);
    const cats = await request(app.getHttpServer()).get('/v1/medicines/categories').expect(200);
    expect(cats.body.find((c: { code: string }) => c.code === 'N').count).toBeGreaterThan(0);
    const fx = await request(app.getHttpServer()).get('/v1/fx/rates').expect(200);
    expect(fx.body.isFallback).toBe(true);
  });
});
