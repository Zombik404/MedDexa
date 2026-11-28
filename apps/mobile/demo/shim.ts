/**
 * Offline demo backend for the static web preview of the MedDexa app.
 *
 * It replaces `fetch` for the API base with answers computed in the browser from a snapshot
 * of the (fictional) demo catalogue recorded from the real API. Search, categories, barcode
 * lookup, comparison (with the real shared engine), pharmacies near you and opening hours
 * all work; sign-in and photo recognition need the real server and say so.
 */
import {
  categoryBySlug,
  compareMedicines,
  hasCyrillic,
  normalizeText,
  parseScannedCode,
  transliterateCyrillic,
  type ComparableMedicine,
  type MedicineSummary,
  type PharmacySummary,
} from '@meddexa/shared';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Snapshot = any;

const API = 'https://demo.meddexa.invalid/v1';
const D: Snapshot = (globalThis as any).__MDX_DATA;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, code: string, message: string) => json({ statusCode: status, code, message }, status);

const cur = (q: URLSearchParams) => (q.get('currency') === 'HUF' ? 'HUF' : 'EUR');
const bucket = (q: URLSearchParams) => D.currencies[cur(q)];

const ingredientById = new Map<string, any>(D.ingredients.map((i: any) => [i.id, i]));
function haystack(m: MedicineSummary): string {
  const ids: [string, string | null][] = D.ingredientIdsByMedicine[m.id] ?? [];
  const syn = ids.flatMap(([id, moiety]) => [id, moiety].filter(Boolean).flatMap((x) => [ingredientById.get(x!)?.name ?? '', ...(ingredientById.get(x!)?.synonyms ?? [])]));
  return normalizeText([m.name, m.brand, m.manufacturer, ...m.ingredients.flatMap((i) => [i.substanceName, i.moietyName ?? '']), ...syn].join(' '));
}
const words = (s: string) => s.split(/[^a-z0-9%]+/).filter(Boolean);

function matchesQuery(m: MedicineSummary, raw: string): boolean {
  const q = normalizeText(hasCyrillic(raw) ? transliterateCyrillic(raw) : raw);
  const hay = words(haystack(m));
  return words(q).every((t) => hay.some((w) => w.startsWith(t)));
}

function paged<T>(items: T[], q: URLSearchParams): Response {
  const page = Math.max(1, Number(q.get('page') ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(q.get('pageSize') ?? 20)));
  const slice = items.slice((page - 1) * pageSize, page * pageSize);
  return json({ items: slice, page, pageSize, total: items.length, hasMore: page * pageSize < items.length });
}

function searchMedicines(q: URLSearchParams): MedicineSummary[] {
  let list: MedicineSummary[] = [...bucket(q).summaries];
  const text = q.get('q');
  if (text) list = list.filter((m) => matchesQuery(m, text));
  const category = q.get('category');
  if (category) {
    const c = categoryBySlug(category);
    list = list.filter((m) => !!c && c.atcPrefixes.some((p) => (m.atcCode ?? '').startsWith(p)));
  }
  const atc = q.get('atc');
  if (atc) list = list.filter((m) => (m.atcCode ?? '').startsWith(atc.toUpperCase()));
  const ingredients = q.get('ingredients');
  if (ingredients) {
    const wanted = ingredients.split(',').map((x) => normalizeText(x));
    list = list.filter((m) => wanted.every((w) => m.ingredients.some((i) => [i.substanceName, i.moietyName ?? ''].some((n) => normalizeText(n) === w))));
  }
  for (const key of ['prescription', 'country'] as const) {
    const v = q.get(key);
    if (v) list = list.filter((m) => (key === 'country' ? v.toUpperCase().split(',').includes(m.countryCode ?? '') : m.prescription === v.toUpperCase()));
  }
  const manufacturer = q.get('manufacturer');
  if (manufacturer) list = list.filter((m) => normalizeText(m.manufacturer ?? '').includes(normalizeText(manufacturer)));
  const strength = q.get('strength');
  if (strength) list = list.filter((m) => m.ingredients.some((i) => normalizeText(i.display ?? '') === normalizeText(strength)));
  const pack = q.get('packageSize');
  if (pack) list = list.filter((m) => Number(m.packageSize?.quantity) === Number(pack));
  const reg = q.get('registrationNumber');
  if (reg) list = list.filter((m) => (bucket(q).details[m.id]?.registrations ?? []).some((r: any) => r.registrationNumber === reg));
  if (q.get('route')) list = list.filter((m) => m.route === q.get('route'));
  if (q.get('form')) list = list.filter((m) => m.form?.code === q.get('form'));
  if (q.get('hasPrice') === 'true') list = list.filter((m) => !!m.lowestPrice);
  const barcode = q.get('barcode');
  if (barcode) {
    const ids = scanIds(barcode);
    list = list.filter((m) => ids.includes(m.id));
  }
  const sort = q.get('sort');
  if (sort === 'price') list.sort((a, b) => (a.lowestPrice?.amount ?? Infinity) - (b.lowestPrice?.amount ?? Infinity));
  else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'rating') list.sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
  else list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function scanIds(raw: string): string[] {
  const scan = parseScannedCode(raw);
  const keys = new Set(scan.candidates.map((c) => `${c.system}:${c.code}`));
  return [...new Set<string>(D.codes.filter((c: any) => keys.has(`${c.system}:${c.code}`)).map((c: any) => c.medicineId))];
}

/* ---- pharmacies ---- */
const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const TZ: Record<string, string> = { HU: 'Europe/Budapest', DE: 'Europe/Berlin', AT: 'Europe/Vienna', FR: 'Europe/Paris', ES: 'Europe/Madrid', IT: 'Europe/Rome', PL: 'Europe/Warsaw', NL: 'Europe/Amsterdam', PT: 'Europe/Lisbon', RO: 'Europe/Bucharest', SK: 'Europe/Bratislava', CZ: 'Europe/Prague' };
function openNow(id: string, country: string): boolean | null {
  const hours = D.pharmacies[id]?.openingHours as { day: number; opens: string; closes: string }[] | undefined;
  if (!hours?.length) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ[country] ?? 'Europe/Budapest', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = WEEKDAY[get('weekday')] ?? 0;
  const time = `${get('hour')}:${get('minute')}`;
  return hours.some((h) => h.day === day && time >= h.opens && time < h.closes);
}
const km = (a: number, b: number, c: number, d: number) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
function livePharmacy<T extends PharmacySummary>(p: T, q: URLSearchParams): T {
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  const distanceKm = q.get('lat') && q.get('lng') ? Math.round(km(lat, lng, p.lat, p.lng) * 100) / 100 : null;
  return { ...p, distanceKm, openNow: openNow(p.id, p.countryCode) };
}
function searchPharmacies(q: URLSearchParams): PharmacySummary[] {
  let list = (D.pharmacyList as PharmacySummary[]).map((p) => livePharmacy(p, q));
  const text = q.get('q');
  if (text) {
    const t = words(normalizeText(text));
    list = list.filter((p) => t.every((w) => normalizeText(`${p.name} ${p.address} ${p.city} ${p.postcode}`).includes(w)));
  }
  if (q.get('country')) list = list.filter((p) => p.countryCode === q.get('country')!.toUpperCase());
  if (q.get('openNow') === 'true') list = list.filter((p) => p.openNow);
  if (q.get('verifiedOnly') === 'true') list = list.filter((p) => p.verified);
  if (q.get('lat') && q.get('lng') && !text) {
    const radius = Number(q.get('radiusKm') ?? 10);
    list = list.filter((p) => (p.distanceKm ?? Infinity) <= radius);
  }
  if (q.get('sort') === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return list;
}

/* ---- type-ahead filter values ---- */
function countBy(values: (string | null | undefined)[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}
function filterOptions(field: string, raw: string, summaries: MedicineSummary[]) {
  const q = normalizeText(hasCyrillic(raw) ? transliterateCyrillic(raw) : raw);
  const starts = (s: string) => normalizeText(s).startsWith(q) || normalizeText(s).split(/\s+/).some((w) => w.startsWith(q));
  const fromCounts = (m: Map<string, number>, secondary?: (v: string) => string | null, label?: (v: string) => string) =>
    [...m.entries()]
      .filter(([v]) => !q || starts(label ? label(v) : v) || (secondary && starts(secondary(v) ?? '')))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([value, count]) => ({ value, label: label ? label(value) : value, secondary: secondary ? secondary(value) : null, count }));
  switch (field) {
    case 'ingredient':
      return fromCounts(countBy(summaries.flatMap((m) => [...new Set(m.ingredients.map((i) => i.moietyName ?? i.substanceName))])));
    case 'manufacturer':
      return fromCounts(countBy(summaries.map((m) => m.manufacturer)));
    case 'strength':
      return fromCounts(countBy(summaries.flatMap((m) => m.ingredients.map((i) => i.display))));
    case 'packageSize': {
      const units = new Map(summaries.filter((m) => m.packageSize).map((m) => [String(Number(m.packageSize!.quantity)), m.packageSize!.unit]));
      return fromCounts(countBy(summaries.map((m) => (m.packageSize ? String(Number(m.packageSize.quantity)) : null))), undefined, (v) => `${v} ${units.get(v) ?? ''}`.trim());
    }
    case 'atc': {
      const names = new Map<string, string>((D.atc ?? []).map((a: any) => [a.code, a.name]));
      const counts = new Map<string, number>();
      for (const a of D.atc ?? []) {
        const n = summaries.filter((m) => (m.atcCode ?? '').startsWith(a.code)).length;
        if (n) counts.set(a.code, n);
      }
      return [...counts.entries()]
        .filter(([c]) => !raw || c.startsWith(raw.trim().toUpperCase()) || starts(names.get(c) ?? ''))
        .sort((a, b) => Number(b[0].startsWith(raw.trim().toUpperCase())) - Number(a[0].startsWith(raw.trim().toUpperCase())) || a[0].length - b[0].length || a[0].localeCompare(b[0]))
        .slice(0, 12)
        .map(([value, count]) => ({ value, label: value, secondary: names.get(value) ?? null, count }));
    }
    case 'registration': {
      const regs = summaries.flatMap((m) => (D.currencies.EUR.details[m.id]?.registrations ?? []).map((r: any) => ({ value: r.registrationNumber, label: r.registrationNumber, secondary: `${r.countryCode} · ${m.name}`, count: 1 })));
      return regs.filter((r: any) => r.value && r.value.toUpperCase().startsWith(raw.trim().toUpperCase())).slice(0, 12);
    }
    default:
      return [];
  }
}

/* ---- router ---- */
async function handle(method: string, path: string, q: URLSearchParams, body: any): Promise<Response> {
  const b = bucket(q);
  let m: RegExpMatchArray | null;
  if (path === '/meta') return json(D.meta);
  if (path === '/medicines/categories') return json(D.categories);
  if (path === '/medicines/popular') return json(b.popular);
  if (path === '/medicines/popular-searches') return json(D.popularSearches ?? []);
  if (path === '/medicines/search') return paged(searchMedicines(q), q);
  if (path === '/medicines/suggest') {
    const text = q.get('q') ?? '';
    return json(
      (b.summaries as MedicineSummary[])
        .filter((x) => matchesQuery(x, text))
        .slice(0, 8)
        .map((x) => ({ type: 'medicine', id: x.id, label: x.name, secondary: x.manufacturer })),
    );
  }
  if (path === '/ingredients/search') {
    const raw = q.get('q') ?? '';
    const t = normalizeText(hasCyrillic(raw) ? transliterateCyrillic(raw) : raw);
    if (t.length < 2) return fail(400, 'VALIDATION_ERROR', 'Query too short');
    const hits = (D.ingredients as any[])
      .map((i) => {
        const nameHit = normalizeText(i.name).startsWith(t) || normalizeText(i.name).includes(` ${t}`);
        const syn = (i.synonyms as string[]).find((s) => normalizeText(s).startsWith(t)) ?? null;
        if (!nameHit && !syn) return null;
        const count = Object.values(D.ingredientIdsByMedicine as Record<string, [string, string | null][]>).filter((list) =>
          list.some(([id, moiety]) => id === i.id || moiety === i.id),
        ).length;
        return { id: i.id, name: i.name, synonym: nameHit ? null : syn, medicineCount: count };
      })
      .filter((h): h is NonNullable<typeof h> => !!h && h.medicineCount > 0)
      .sort((a, c) => Number(!!a.synonym) - Number(!!c.synonym) || a.name.localeCompare(c.name))
      .slice(0, 8);
    return json(hits);
  }
  if (path === '/ingredients/names') {
    const lang = (q.get('lang') ?? 'en').slice(0, 2);
    const rows = (D.ingredients as any[]).filter((i) => i.local?.[lang]);
    return json({ byId: Object.fromEntries(rows.map((i) => [i.id, i.local[lang]])), byName: Object.fromEntries(rows.map((i) => [i.name, i.local[lang]])) });
  }
  if (path === '/medicines/filter-options') return json(filterOptions(q.get('field') ?? '', q.get('q') ?? '', b.summaries));
  if (path === '/medicines/scan') {
    const code = q.get('code') ?? '';
    const ids = scanIds(code);
    return json({ scan: parseScannedCode(code), matches: b.summaries.filter((x: MedicineSummary) => ids.includes(x.id)), fetchedFromOfficialSource: false });
  }
  if (path === '/medicines/photo' || path === '/medicines/photo/text') {
    return fail(503, 'DEMO_OFFLINE', 'Photo recognition runs on the MedDexa server and is not available in this offline preview. Try the barcode or the name instead.');
  }
  if ((m = path.match(/^\/medicines\/([^/]+)$/))) return b.details[m[1]!] ? json(b.details[m[1]!]) : fail(404, 'MEDICINE_NOT_FOUND', 'Medicine not found');
  if ((m = path.match(/^\/medicines\/([^/]+)\/prices$/))) return json(b.prices[m[1]!]);
  if ((m = path.match(/^\/medicines\/([^/]+)\/similar$/))) return json(b.similar[m[1]!] ?? []);
  if ((m = path.match(/^\/(medicines|pharmacies)\/([^/]+)\/reviews$/))) {
    if (method !== 'GET') return fail(401, 'UNAUTHORIZED', 'Sign-in is not available in the offline preview');
    return json(D.reviews[m[2]!] ?? { items: [], page: 1, pageSize: 10, total: 0, hasMore: false });
  }
  if (path === '/compare' && method === 'POST') {
    const ids: string[] = body?.medicineIds ?? [];
    const c = body?.currency === 'HUF' ? 'HUF' : 'EUR';
    try {
      const result = compareMedicines(ids.map((id) => D.comparables[id] as ComparableMedicine));
      return json({
        medicines: ids.map((id) => D.currencies[c].summaries.find((x: MedicineSummary) => x.id === id)),
        result,
        prices: Object.fromEntries(ids.map((id) => [id, D.offers[c][id] ?? null])),
      });
    } catch (e) {
      return fail(400, 'COMPARE_INVALID', (e as Error).message);
    }
  }
  if (path === '/pharmacies') return paged(searchPharmacies(q), q);
  if ((m = path.match(/^\/pharmacies\/([^/]+)$/))) {
    const p = D.pharmacies[m[1]!];
    return p ? json(livePharmacy(p, q)) : fail(404, 'PHARMACY_NOT_FOUND', 'Pharmacy not found');
  }
  if (path.startsWith('/auth/') || path.startsWith('/me') || path.startsWith('/reviews/')) {
    return fail(path.startsWith('/auth/') ? 400 : 401, 'DEMO_OFFLINE', 'Accounts are not available in the offline preview — everything else works as a guest.');
  }
  return fail(404, 'NOT_FOUND', `Not available in the preview: ${path}`);
}

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(API)) return realFetch(input as RequestInfo, init);
  const u = new URL(url);
  const method = (init?.method ?? 'GET').toUpperCase();
  let body: unknown = null;
  if (typeof init?.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = null;
    }
  }
  await new Promise((r) => setTimeout(r, 120)); // feel of a network round-trip
  return handle(method, u.pathname.slice('/v1'.length), u.searchParams, body);
}) as typeof fetch;
