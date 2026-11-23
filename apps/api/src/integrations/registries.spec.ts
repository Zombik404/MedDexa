import { gtinFromSpanishCn } from '@meddexa/shared';
import { fetchCimaByCn, mapCimaMedicamento, mapCimaPresentation, parseCimaPresentation } from './adapters/cima.adapter';
import { buildPuphaMedicines, mapRendelhet, puphaStrength, puphaUrlFor, type PuphaRow } from './adapters/pupha.adapter';
import { packageCodes } from './importer';

// Shape copied from the live CIMA response for nregistro 51347 (Nov 2026).
const aspirinaC = {
  nregistro: '51347',
  nombre: 'ASPIRINA C 400 mg/240 mg COMPRIMIDOS EFERVESCENTES',
  labtitular: 'Bayer Hispania, S.L.',
  receta: false,
  estado: { aut: 1009756800000 },
  formaFarmaceutica: { id: 1, nombre: 'COMPRIMIDO EFERVESCENTE' },
  viasAdministracion: [{ id: 1, nombre: 'VÍA ORAL' }],
  fotos: [
    { tipo: 'materialas', url: 'https://cima.aemps.es/cima/fotos/thumbnails/materialas/51347/51347_materialas.jpg' },
    { tipo: 'formafarmac', url: 'https://cima.aemps.es/cima/fotos/thumbnails/formafarmac/51347/51347_formafarmac.jpg' },
  ],
  presentaciones: [
    { cn: '712729', nombre: 'ASPIRINA C 400 mg/240 mg COMPRIMIDOS EFERVESCENTES , 10 comprimidos' },
    { cn: '651877', nombre: 'ASPIRINA C 400 mg/240 mg COMPRIMIDOS EFERVESCENTES , 20 comprimidos' },
  ],
  atcs: [
    { codigo: 'N02B', nombre: 'OTROS ANALGESICOS Y ANTIPIRETICOS', nivel: 3 },
    { codigo: 'N02BA51', nombre: 'Acido acetilsalicilico, combinaciones excluyendo psicolepticos', nivel: 5 },
  ],
  principiosActivos: [
    { id: 176, codigo: '176A', nombre: 'ACETILSALICILICO ACIDO', cantidad: '400', unidad: 'mg', orden: 1 },
    { id: 61, codigo: '61A', nombre: 'ASCORBICO ACIDO', cantidad: '240', unidad: 'mg', orden: 2 },
  ],
};

describe('CIMA photos and pack codes', () => {
  it('keeps the official packaging photo with attribution', () => {
    const m = mapCimaMedicamento(aspirinaC);
    expect(m.imageUrl).toBe('https://cima.aemps.es/cima/fotos/thumbnails/materialas/51347/51347_materialas.jpg');
    expect(m.imageCredit).toBe('AEMPS · CIMA');
    expect(m.atcCode).toBe('N02BA51');
  });

  it('turns presentations into packages with CN and the EAN-13 printed on the box', () => {
    expect(parseCimaPresentation('X , 10 comprimidos')).toEqual({ quantity: 10, unit: 'tablet' });
    expect(parseCimaPresentation('X , 1 frasco de 200 ml')).toEqual({ quantity: 200, unit: 'ml' });
    expect(parseCimaPresentation('X , envase')).toBeNull();
    const pkg = mapCimaPresentation(aspirinaC.presentaciones[0]!);
    expect(pkg.barcode).toBe(gtinFromSpanishCn('712729'));
    expect(packageCodes(pkg)).toEqual(
      expect.arrayContaining([
        { system: 'CN_ES', code: '712729', countryCode: 'ES' },
        { system: 'GTIN', code: `0${gtinFromSpanishCn('712729')}`, countryCode: null },
      ]),
    );
  });

  it('fetches a product by national code and treats an empty answer as unknown', async () => {
    const ok = jest.fn(async () => new Response(JSON.stringify(aspirinaC), { status: 200 }));
    const m = await fetchCimaByCn(ok as unknown as typeof fetch, 'https://cima.aemps.es/cima/rest', '712729');
    expect(ok).toHaveBeenCalledWith('https://cima.aemps.es/cima/rest/medicamento?cn=712729', expect.anything());
    expect(m?.sourceReference).toBe('51347');
    const empty = jest.fn(async () => new Response('', { status: 200 }));
    expect(await fetchCimaByCn(empty as unknown as typeof fetch, 'https://x/', '000000')).toBeNull();
  });
});

describe('NEAK PUPHA adapter (Hungary)', () => {
  const base: PuphaRow = {
    OEP_TTT: '213456789',
    OEP_TK: 'OGYI-T-9999/01',
    OEP_EAN: '5991234567893',
    OEP_ATC: 'M01AE01',
    OEP_NEV: 'PÉLDA IBUPROFEN 400 MG FILMTABLETTA',
    KISZ_MENNY: 20,
    KISZ_EGYS: 'db',
    GYFORMA: 'filmtabletta',
    HATOANYAG: 'ibuprofen',
    HATO_MENNY: 400,
    HATO_EGYS: 'mg',
    OHATO_MENNY: 8000,
    FORGENGT: 'Példa Pharma Kft.',
    OEP_FAB: 1290,
    RENDELHET: 'VN',
    FORGALOMBAN: 1,
    OEP_DAT: '20261101',
    VEGE: new Date('2099-12-31'),
  };

  it('maps prescription categories', () => {
    expect(mapRendelhet('VN')).toBe('OTC');
    expect(mapRendelhet('V')).toBe('RX');
    expect(mapRendelhet('SZ')).toBe('RX');
    expect(mapRendelhet(null)).toBe('UNKNOWN');
  });

  it('uses the strength only when the record is self-consistent', () => {
    expect(puphaStrength(base)).toEqual({ amount: 400, unit: 'mg' });
    expect(puphaStrength({ ...base, OHATO_MENNY: 400 })).toEqual({ amount: null, unit: null });
    expect(puphaStrength({ ...base, HATOANYAG: 'paracetamol, coffein' })).toEqual({ amount: null, unit: null });
  });

  it('groups packs into one product with EAN, TTT code and the published price', () => {
    const rows: PuphaRow[] = [
      base,
      { ...base, OEP_TTT: '213456790', OEP_TK: 'OGYI-T-9999/02', OEP_EAN: '5991234567909', KISZ_MENNY: 50, OHATO_MENNY: 20000, OEP_FAB: 2590 },
      { ...base, OEP_TTT: '200000001', OEP_NEV: 'RÉGI TERMÉK', VEGE: new Date('2020-01-01') },
    ];
    const [m, ...rest] = buildPuphaMedicines(rows, new Date('2026-11-23'));
    expect(rest).toHaveLength(0);
    expect(m!.countryCode).toBe('HU');
    expect(m!.registrationNumber).toBe('OGYI-T-9999');
    expect(m!.formCode).toBe('FILM_COATED_TABLET');
    expect(m!.route).toBe('ORAL');
    expect(m!.prescription).toBe('OTC');
    expect(m!.ingredients).toEqual([{ name: 'ibuprofen', amount: 400, unit: 'mg' }]);
    expect(m!.packages.map((p) => [p.quantity, p.unit, p.barcode, p.price?.amount, p.price?.currency])).toEqual([
      [20, 'tablet', '5991234567893', 1290, 'HUF'],
      [50, 'tablet', '5991234567909', 2590, 'HUF'],
    ]);
    expect(m!.packages[0]!.codes).toEqual([{ system: 'TTT_HU', code: '213456789', countryCode: 'HU' }]);
  });

  it('builds the monthly download URL', () => {
    expect(puphaUrlFor(new Date('2026-11-23T10:00:00Z'))).toContain('PUPHA_20261101_v3.zip');
  });
});
