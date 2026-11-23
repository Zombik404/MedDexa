import { normalizeText } from '@meddexa/shared';
import type { DataAdapter, SyncContext, SyncResult } from '../adapter';
import { parseOsmOpeningHours } from './opening-hours';

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface MappedPharmacy {
  sourceReference: string;
  name: string;
  street: string;
  city: string | null;
  postcode: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  openingHours: ReturnType<typeof parseOsmOpeningHours>;
  wheelchair: boolean;
}

export function buildOverpassQuery(countryCode: string): string {
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('countryCode must be ISO 3166-1 alpha-2');
  return `[out:json][timeout:300];area["ISO3166-1"="${countryCode}"][admin_level=2]->.a;nwr["amenity"="pharmacy"](area.a);out center tags;`;
}

/** Maps one OSM element to a pharmacy record; returns null when it lacks a name or position. */
export function mapOsmPharmacy(el: OsmElement): MappedPharmacy | null {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const name = t.name ?? t['name:en'];
  if (!name || lat == null || lng == null) return null;
  const street = [t['addr:street'] ?? t['addr:place'], t['addr:housenumber']].filter(Boolean).join(' ');
  const website = t.website ?? t['contact:website'] ?? null;
  return {
    sourceReference: `${el.type}/${el.id}`,
    name,
    street: street || '',
    city: t['addr:city'] ?? null,
    postcode: t['addr:postcode'] ?? null,
    lat,
    lng,
    phone: t.phone ?? t['contact:phone'] ?? null,
    website: website && /^https?:\/\//.test(website) ? website : website ? `https://${website}` : null,
    openingHours: parseOsmOpeningHours(t.opening_hours),
    wheelchair: t.wheelchair === 'yes',
  };
}

/**
 * OpenStreetMap pharmacies (ODbL). Crowd-sourced data, so records are stored as
 * UNVERIFIED and phone/website are not marked verified. Config: { countries: ["HU", ...] }.
 */
export const overpassAdapter: DataAdapter = {
  key: 'overpass',
  requiredConfig: ['countries'],
  async sync(ctx: SyncContext): Promise<SyncResult> {
    const countries = ctx.config.countries as string[];
    const result: SyncResult = { read: 0, created: 0, updated: 0, failed: 0 };
    const now = new Date();
    for (const country of countries) {
      const res = await ctx.fetch(ctx.source.url ?? 'https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MedDexa/0.1 (data sync)' },
        body: `data=${encodeURIComponent(buildOverpassQuery(country))}`,
      });
      if (!res.ok) throw new Error(`Overpass responded ${res.status} for ${country}`);
      const json = (await res.json()) as { elements: OsmElement[] };
      for (const el of json.elements) {
        result.read++;
        const p = mapOsmPharmacy(el);
        if (!p) {
          result.failed++;
          continue;
        }
        const where = { sourceId_sourceReference: { sourceId: ctx.source.id, sourceReference: p.sourceReference } };
        const existing = await ctx.prisma.pharmacy.findUnique({ where });
        const data = {
          name: p.name,
          normalizedName: normalizeText(p.name),
          street: p.street,
          city: p.city,
          postcode: p.postcode,
          countryCode: country,
          lat: p.lat,
          lng: p.lng,
          phone: p.phone,
          website: p.website,
          syncedAt: now,
          verification: 'UNVERIFIED' as const,
          confidence: 0.6,
        };
        const saved = existing
          ? await ctx.prisma.pharmacy.update({ where: { id: existing.id }, data })
          : await ctx.prisma.pharmacy.create({ data: { ...data, sourceId: ctx.source.id, sourceReference: p.sourceReference } });
        existing ? result.updated++ : result.created++;
        if (p.openingHours) {
          await ctx.prisma.openingHours.deleteMany({ where: { pharmacyId: saved.id } });
          await ctx.prisma.openingHours.createMany({ data: p.openingHours.map((h) => ({ ...h, pharmacyId: saved.id })) });
        }
        if (p.wheelchair) {
          await ctx.prisma.pharmacyServiceLink.upsert({
            where: { pharmacyId_serviceCode: { pharmacyId: saved.id, serviceCode: 'WHEELCHAIR_ACCESS' } },
            update: {},
            create: { pharmacyId: saved.id, serviceCode: 'WHEELCHAIR_ACCESS' },
          });
        }
      }
      ctx.log(`Overpass ${country}: ${json.elements.length} elements`);
    }
    return result;
  },
};
