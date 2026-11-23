import { gs1CheckDigit, gtinFromSpanishCn, isValidGtin, isValidPzn, parseScannedCode, toGtin14 } from './barcode';
import { categoryForAtc, MEDICINE_CATEGORIES } from './categories';

describe('GS1 check digits', () => {
  it('validates well-known EAN-13 codes', () => {
    expect(isValidGtin('4006381333931')).toBe(true);
    expect(isValidGtin('4006381333932')).toBe(false);
    expect(gs1CheckDigit('400638133393')).toBe(1);
  });
  it('pads to GTIN-14', () => {
    expect(toGtin14('4006381333931')).toBe('04006381333931');
    expect(toGtin14('123')).toBeNull();
  });
});

describe('PZN', () => {
  it('accepts the IFA example and rejects a wrong check digit', () => {
    expect(isValidPzn('27580899')).toBe(true);
    expect(isValidPzn('27580898')).toBe(false);
  });
});

describe('parseScannedCode', () => {
  it('derives the Spanish national code from a linear EAN-13', () => {
    const ean = gtinFromSpanishCn('712729')!;
    expect(ean).toHaveLength(13);
    expect(isValidGtin(ean)).toBe(true);
    const scan = parseScannedCode(ean);
    expect(scan.gtin).toBe(`0${ean}`);
    expect(scan.candidates).toEqual(
      expect.arrayContaining([
        { system: 'GTIN', code: `0${ean}`, countryCode: null },
        { system: 'CN_ES', code: '712729', countryCode: 'ES' },
      ]),
    );
  });

  it('reads a GS1 DataMatrix with FNC1 separators, expiry, batch, serial and NHRN', () => {
    const ean = gtinFromSpanishCn('651877')!;
    const raw = `]d201${'0' + ean}17270131` + `10AB12C\u001d21XYZ987\u001d712651877`;
    const scan = parseScannedCode(raw);
    expect(scan.gtin).toBe(`0${ean}`);
    expect(scan.expiry).toBe('270131');
    expect(scan.batch).toBe('AB12C');
    expect(scan.serial).toBe('XYZ987');
    expect(scan.candidates.filter((c) => c.system === 'CN_ES')).toEqual([{ system: 'CN_ES', code: '651877', countryCode: 'ES' }]);
  });

  it('reads the human-readable GS1 form', () => {
    const scan = parseScannedCode('(01)04006381333931(17)281231(10)LOT1');
    expect(scan.gtin).toBe('04006381333931');
    expect(scan.batch).toBe('LOT1');
  });

  it('recognises French CIP13 inside a GTIN', () => {
    const body = '340093640311';
    const cip13 = `${body}${gs1CheckDigit(body)}`;
    const scan = parseScannedCode(cip13);
    expect(scan.candidates).toContainEqual({ system: 'CIP13', code: cip13, countryCode: 'FR' });
  });

  it('reads a German Code 39 PZN and an NTIN', () => {
    expect(parseScannedCode('-27580899').candidates).toEqual([{ system: 'PZN', code: '27580899', countryCode: 'DE' }]);
    const body = '415027580899';
    const ntin = `${body}${gs1CheckDigit(body)}`;
    expect(parseScannedCode(ntin).candidates).toContainEqual({ system: 'PZN', code: '27580899', countryCode: 'DE' });
  });

  it('marks Hungarian GTINs and offers typed national codes', () => {
    const body = '599123456789';
    const hu = `${body}${gs1CheckDigit(body)}`;
    expect(parseScannedCode(hu).candidates[0]).toEqual({ system: 'GTIN', code: `0${hu}`, countryCode: 'HU' });
    expect(parseScannedCode('712729').candidates).toEqual([{ system: 'CN_ES', code: '712729', countryCode: 'ES' }]);
  });

  it('returns nothing for text or invalid codes', () => {
    expect(parseScannedCode('hello').candidates).toEqual([]);
    expect(parseScannedCode('4006381333932').gtin).toBeNull();
    expect(parseScannedCode('').candidates).toEqual([]);
  });
});

describe('categories', () => {
  it('maps ATC codes to everyday categories', () => {
    expect(categoryForAtc('M01AE01')?.slug).toBe('pain');
    expect(categoryForAtc('N02BE01')?.slug).toBe('pain');
    expect(categoryForAtc('R06AE07')?.slug).toBe('allergy');
    expect(categoryForAtc('A02BC01')?.slug).toBe('digestion');
    expect(categoryForAtc('L01XC02')).toBeUndefined();
    expect(categoryForAtc(null)).toBeUndefined();
  });
  it('has unique slugs and non-overlapping prefixes', () => {
    const slugs = MEDICINE_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const prefixes = MEDICINE_CATEGORIES.flatMap((c) => c.atcPrefixes);
    for (const a of prefixes) for (const b of prefixes) if (a !== b) expect(b.startsWith(a)).toBe(false);
  });
});
