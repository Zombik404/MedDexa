import { buildBdpmMedicines } from './adapters/bdpm.adapter';
import { mapCimaMedicamento, parseCimaStrength } from './adapters/cima.adapter';
import { parseEcbXml } from './adapters/ecb.adapter';
import { mapGooglePlace } from './adapters/google-places.adapter';
import { parseOsmOpeningHours } from './adapters/opening-hours';
import { buildOverpassQuery, mapOsmPharmacy } from './adapters/overpass.adapter';
import { mapFormCode, mapRoute, parseDose, parseEuroNumber, parsePackQuantity, parseReference } from './normalise';

describe('ECB adapter', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube><Cube time="2026-11-20"><Cube currency="USD" rate="1.0812"/><Cube currency="HUF" rate="397.15"/><Cube currency="PLN" rate="4.2440"/></Cube></Cube>
</gesmes:Envelope>`;
  it('parses the daily reference rates', () => {
    expect(parseEcbXml(xml)).toEqual({ date: '2026-11-20', rates: { USD: 1.0812, HUF: 397.15, PLN: 4.244 } });
  });
  it('rejects unexpected documents', () => {
    expect(() => parseEcbXml('<html></html>')).toThrow(/Unexpected/);
  });
});

describe('OpenStreetMap adapter', () => {
  it('builds a country query and rejects injection', () => {
    expect(buildOverpassQuery('HU')).toContain('"ISO3166-1"="HU"');
    expect(() => buildOverpassQuery('HU"];out;')).toThrow();
  });

  it('maps nodes and ways (center) and skips unnamed features', () => {
    const node = mapOsmPharmacy({
      type: 'node', id: 1, lat: 47.5, lon: 19.05,
      tags: { amenity: 'pharmacy', name: 'Szent István Patika', 'addr:street': 'Fő utca', 'addr:housenumber': '1', 'addr:city': 'Budapest', 'addr:postcode': '1011', website: 'example.hu', opening_hours: 'Mo-Fr 08:00-20:00; Sa 08:00-13:00', wheelchair: 'yes' },
    })!;
    expect(node).toMatchObject({ sourceReference: 'node/1', street: 'Fő utca 1', city: 'Budapest', website: 'https://example.hu', wheelchair: true });
    expect(node.openingHours).toHaveLength(6);
    const way = mapOsmPharmacy({ type: 'way', id: 2, center: { lat: 1, lon: 2 }, tags: { name: 'X' } })!;
    expect(way).toMatchObject({ lat: 1, lng: 2, sourceReference: 'way/2' });
    expect(mapOsmPharmacy({ type: 'node', id: 3, lat: 1, lon: 1, tags: {} })).toBeNull();
  });
});

describe('OSM opening_hours parser', () => {
  it('parses ranges, lists and split shifts', () => {
    expect(parseOsmOpeningHours('Mo,We 08:00-12:00,14:00-18:00')).toEqual([
      { day: 0, opens: '08:00', closes: '12:00' },
      { day: 0, opens: '14:00', closes: '18:00' },
      { day: 2, opens: '08:00', closes: '12:00' },
      { day: 2, opens: '14:00', closes: '18:00' },
    ]);
    expect(parseOsmOpeningHours('24/7')).toHaveLength(7);
    expect(parseOsmOpeningHours('Mo-Su 08:00-20:00; Su off')!.some((h) => h.day === 6)).toBe(false);
    expect(parseOsmOpeningHours('Fr-Mo 10:00-12:00')!.map((h) => h.day)).toEqual([0, 4, 5, 6]);
  });
  it('returns null for syntax it does not understand', () => {
    expect(parseOsmOpeningHours('Mo-Fr 08:00-20:00; PH off')).toBeNull();
    expect(parseOsmOpeningHours('sunrise-sunset')).toBeNull();
    expect(parseOsmOpeningHours(undefined)).toBeNull();
  });
});

describe('CIMA adapter (Spain)', () => {
  it('parses strengths with and without reference quantities', () => {
    expect(parseCimaStrength('400', 'mg')).toEqual({ amount: 400, unit: 'mg', perAmount: null, perUnit: null });
    expect(parseCimaStrength('100', 'mg/5 ml')).toEqual({ amount: 100, unit: 'mg', perAmount: 5, perUnit: 'ml' });
    expect(parseCimaStrength('1,16', 'g/100 g')).toEqual({ amount: 1.16, unit: 'g', perAmount: 100, perUnit: 'g' });
    expect(parseCimaStrength(undefined, 'mg').amount).toBeNull();
  });

  it('maps a medicamento record (shape verified against the live API)', () => {
    const m = mapCimaMedicamento({
      nregistro: '51347',
      nombre: 'ASPIRINA C 400 mg/240 mg COMPRIMIDOS EFERVESCENTES',
      labtitular: 'Bayer Hispania S.L.',
      receta: false,
      estado: { aut: 107737200000 },
      principiosActivos: [
        { id: 2, nombre: 'ASCORBICO ACIDO', cantidad: '240', unidad: 'mg', orden: 2 },
        { id: 176, nombre: 'ACETILSALICILICO ACIDO', cantidad: '400', unidad: 'mg', orden: 1 },
      ],
      atcs: [{ codigo: 'N02B', nombre: 'OTROS ANALGESICOS', nivel: 3 }, { codigo: 'N02BA51', nombre: 'x', nivel: 5 }],
      viasAdministracion: [{ id: 48, nombre: 'VÍA ORAL' }],
      formaFarmaceutica: { id: 43, nombre: 'COMPRIMIDO EFERVESCENTE' },
      docs: [{ tipo: 1, url: 'https://cima.aemps.es/cima/pdfs/ft/51347/FT_51347.pdf' }, { tipo: 2, url: 'https://cima.aemps.es/p.pdf' }],
    });
    expect(m).toMatchObject({
      countryCode: 'ES',
      formCode: 'EFFERVESCENT_TABLET',
      route: 'ORAL',
      release: 'IMMEDIATE',
      prescription: 'OTC',
      registrationStatus: 'AUTHORISED',
      atcCode: 'N02BA51',
    });
    expect(m.ingredients.map((i) => [i.name, i.amount])).toEqual([['ACETILSALICILICO ACIDO', 400], ['ASCORBICO ACIDO', 240]]);
    expect(m.documents!.map((d) => d.kind)).toEqual(['SMPC', 'PIL']);
  });
});

describe('BDPM adapter (France)', () => {
  const specialities = [
    '60234100\tDOLIPRANE 500 mg, comprimé\tcomprimé\torale\tAutorisation active\tProcédure nationale\tCommercialisée\t09/07/1998\t\t\tOPELLA HEALTHCARE FRANCE\tNon',
    '61111111\tIBUPROFENE LYSINE TEST 400 mg, comprimé pelliculé\tcomprimé pelliculé\torale\tAutorisation active\tProcédure nationale\tCommercialisée\t01/01/2010\t\t\tTEST LAB\tNon',
    '62222222\tPRODUIT RETIRE 10 mg, gélule\tgélule\torale\tAutorisation abrogée\tProcédure nationale\tNon commercialisée\t01/01/2000\t\t\tX\tNon',
  ].join('\n');
  const compositions = [
    '60234100\tcomprimé\t02202\tPARACÉTAMOL\t500 mg\tun comprimé\tSA\t1',
    '61111111\tcomprimé\t11111\tIBUPROFÈNE LYSINE\t684 mg\tun comprimé\tSA\t1',
    '61111111\tcomprimé\t22222\tIBUPROFÈNE\t400 mg\tun comprimé\tFT\t1',
  ].join('\n');
  const presentations = [
    '60234100\t3400932\tplaquette(s) thermoformée(s) PVC-Aluminium de 16 comprimé(s)\tPrésentation active\tDéclaration de commercialisation\t01/01/1999\t3400934998331\toui\t65%\t1,16\t',
  ].join('\n');

  it('builds medicines with moieties, packs and regulated prices; skips withdrawn products', () => {
    const meds = buildBdpmMedicines({ specialities, compositions, presentations }, new Date('2026-11-20'));
    expect(meds).toHaveLength(2);
    const doliprane = meds[0]!;
    expect(doliprane).toMatchObject({ countryCode: 'FR', formCode: 'TABLET', route: 'ORAL', manufacturerName: 'OPELLA HEALTHCARE FRANCE' });
    expect(doliprane.ingredients).toEqual([expect.objectContaining({ name: 'PARACÉTAMOL', amount: 500, unit: 'mg', perAmount: 1, perUnit: 'unit' })]);
    expect(doliprane.packages[0]).toMatchObject({ quantity: 16, unit: 'tablet', barcode: '3400934998331', price: expect.objectContaining({ amount: 1.16, currency: 'EUR' }) });
    const lysine = meds[1]!;
    expect(lysine.formCode).toBe('FILM_COATED_TABLET');
    expect(lysine.ingredients).toEqual([expect.objectContaining({ name: 'IBUPROFÈNE LYSINE', moietyName: 'IBUPROFÈNE', amount: 400, basis: 'MOIETY' })]);
  });
});

describe('Google Places mapping', () => {
  it('maps a place and namespaces its id (never stored)', () => {
    const p = mapGooglePlace(
      { id: 'abc', displayName: { text: 'Apotheke' }, formattedAddress: 'Str. 1', location: { latitude: 48.1, longitude: 11.5 }, addressComponents: [{ shortText: 'DE', types: ['country'] }, { shortText: 'München', types: ['locality'] }] },
      1.2,
    );
    expect(p).toMatchObject({ id: 'gplaces:abc', countryCode: 'DE', city: 'München', verified: false, rating: null });
  });
});

describe('normalisation helpers', () => {
  it('maps national form and route names', () => {
    expect(mapFormCode('comprimé pelliculé')).toBe('FILM_COATED_TABLET');
    expect(mapFormCode('COMPRIMIDO GASTRORRESISTENTE')).toBe('GASTRO_RESISTANT_TABLET');
    expect(mapFormCode('Retardtabletten')).toBe('PROLONGED_RELEASE_TABLET');
    expect(mapFormCode('filmtabletta')).toBe('FILM_COATED_TABLET');
    expect(mapFormCode('suspension buvable')).toBe('ORAL_SUSPENSION');
    expect(mapFormCode('something odd')).toBeNull();
    expect(mapRoute('VÍA ORAL')).toBe('ORAL');
    expect(mapRoute('cutanée')).toBe('CUTANEOUS');
    expect(mapRoute('VÍA TÓPICA')).toBe('CUTANEOUS');
  });
  it('parses doses, references, prices and pack sizes', () => {
    expect(parseDose('1,16 g')).toEqual({ amount: 1.16, unit: 'g' });
    expect(parseDose('100 000 UI')).toEqual({ amount: 100000, unit: 'IU' });
    expect(parseDose('500 microgrammes')).toEqual({ amount: 500, unit: 'µg' });
    expect(parseReference('un comprimé')).toEqual({ perAmount: 1, perUnit: 'unit' });
    expect(parseReference('5 ml de suspension')).toEqual({ perAmount: 5, perUnit: 'ml' });
    expect(parseReference('100 g de gel')).toEqual({ perAmount: 100, perUnit: 'g' });
    expect(parseEuroNumber('1,16')).toBe(1.16);
    expect(parseEuroNumber('1 234,56')).toBe(1234.56);
    expect(parseEuroNumber('')).toBeNull();
    expect(parsePackQuantity('1 flacon(s) de 100 ml')).toEqual({ quantity: 100, unit: 'ml' });
    expect(parsePackQuantity('plaquette(s) de 30 gélule(s)')).toEqual({ quantity: 30, unit: 'capsule' });
  });
});
