import { toPrefixTsQuery } from './medicines/search.service';
import { haversineKm } from './pharmacies/pharmacies.service';
import { isOpenNow, localDayTime } from './pharmacies/opening';
import { moderateText } from './reviews/moderation';
import { validateEnv } from './config/env';

describe('search query builder', () => {
  it('builds safe prefix queries', () => {
    expect(toPrefixTsQuery('Ibuprofén 400mg')).toBe('ibuprofen:* & 400mg:*');
    expect(toPrefixTsQuery("x' | !(drop)")).toBe('x:* & drop:*');
    expect(toPrefixTsQuery('   ')).toBeNull();
  });
});

describe('opening hours', () => {
  // Wednesday 2026-11-25 10:30 in Budapest (UTC+1) = 09:30 UTC
  const wed = new Date('2026-11-25T09:30:00Z');
  it('computes local weekday and time in the pharmacy time zone', () => {
    expect(localDayTime('Europe/Budapest', wed)).toEqual({ day: 2, time: '10:30' });
    expect(localDayTime('Europe/Lisbon', wed)).toEqual({ day: 2, time: '09:30' });
  });
  it('distinguishes open, closed and unknown', () => {
    expect(isOpenNow([{ day: 2, opens: '08:00', closes: '19:00' }], 'Europe/Budapest', wed)).toBe(true);
    expect(isOpenNow([{ day: 2, opens: '11:00', closes: '19:00' }], 'Europe/Budapest', wed)).toBe(false);
    expect(isOpenNow([], 'Europe/Budapest', wed)).toBeNull();
  });
  it('handles spans past midnight', () => {
    const late = new Date('2026-11-26T00:30:00Z'); // Thu 01:30 Budapest
    expect(isOpenNow([{ day: 2, opens: '20:00', closes: '02:00' }], 'Europe/Budapest', late)).toBe(true);
  });
});

describe('haversine', () => {
  it('computes Budapest → Vienna distance', () => {
    expect(haversineKm(47.4979, 19.0402, 48.2082, 16.3738)).toBeCloseTo(214, -1);
  });
});

describe('review moderation', () => {
  it('passes ordinary reviews', () => {
    expect(moderateText('Worked as described, the leaflet was easy to read.').hold).toBe(false);
  });
  it('holds links, personal data, medical claims and abuse', () => {
    expect(moderateText('see https://spam.example').reasons).toContain('contains_link');
    expect(moderateText('call me on +36 30 123 4567').reasons).toContain('personal_data');
    expect(moderateText('This cures my migraine forever').reasons).toContain('medical_claim');
    expect(moderateText('Stop taking your prescription and use this').reasons).toContain('medical_claim');
    expect(moderateText('THIS IS THE WORST PHARMACY EVER SEEN').reasons).toContain('shouting');
  });
});

describe('environment validation', () => {
  const base = { DATABASE_URL: 'postgresql://x@localhost/db', JWT_ACCESS_SECRET: 'x'.repeat(32) };
  it('rejects weak secrets and demo data in production', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/ALLOW_DEMO_DATA/);
    expect(validateEnv({ ...base, NODE_ENV: 'production', ALLOW_DEMO_DATA: 'false' }).NODE_ENV).toBe('production');
  });
});
