import type { MedicineSummary } from '@meddexa/shared';
import { extractBoxText, rankByBoxText } from './box-text';

const med = (id: string, name: string, ingredients: [string, number, string][]): MedicineSummary => ({
  id,
  name,
  brand: name.split(' ')[0]!,
  manufacturer: null,
  countryCode: 'HU',
  atcCode: null,
  form: null,
  route: null,
  release: null,
  prescription: 'OTC',
  packageSize: null,
  ingredients: ingredients.map(([n, amount, unit]) => ({
    substanceId: n,
    substanceName: n,
    moietyId: null,
    moietyName: null,
    amount,
    unit,
    perAmount: null,
    perUnit: null,
    basis: 'SUBSTANCE',
    display: `${amount} ${unit}`,
  })),
  imageUrl: null,
  imageCredit: null,
  rating: null,
  lowestPrice: null,
  isDemo: true,
});

describe('box text', () => {
  it('keeps distinctive words and printed strengths, drops packaging vocabulary', () => {
    const box = extractBoxText(['IBUDEX', '400 mg', 'filmtabletta', 'ibuprofen', '20 db · belsőleges használatra']);
    expect(box.words).toEqual(expect.arrayContaining(['ibudex', 'ibuprofen']));
    expect(box.words).not.toContain('filmtabletta');
    expect(box.doses).toEqual([{ amount: 400, unit: 'mg' }]);
  });

  it('ranks the product whose name and strength match first, and drops weak matches', () => {
    const box = extractBoxText(['IBUDEX 400 mg', 'film-coated tablets', 'ibuprofen']);
    const ranked = rankByBoxText(box, [
      med('a', 'Ibudex 200 mg film-coated tablets', [['ibuprofen', 200, 'mg']]),
      med('b', 'Ibudex 400 mg film-coated tablets', [['ibuprofen', 400, 'mg']]),
      med('c', 'Paradex 500 mg tablets', [['paracetamol', 500, 'mg']]),
    ]);
    expect(ranked.map((r) => r.medicine.id)).toEqual(['b', 'a']);
  });

  it('does not match on a shared ingredient alone without a strength', () => {
    const box = extractBoxText(['ibuprofen']);
    expect(rankByBoxText(box, [med('x', 'Profenil 400 mg tablets', [['ibuprofen', 400, 'mg']])])).toEqual([]);
  });
});
