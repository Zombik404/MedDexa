import { compareMedicines, comparePair, normaliseStrength } from './engine';
import type { ComparableIngredient, ComparableMedicine } from './types';

const TABLET = { code: 'TABLET', name: 'Tablet', group: 'ORAL_SOLID' };
const FILM_TABLET = { code: 'FILM_COATED_TABLET', name: 'Film-coated tablet', group: 'ORAL_SOLID' };
const SUSPENSION = { code: 'ORAL_SUSPENSION', name: 'Oral suspension', group: 'ORAL_LIQUID' };
const GEL = { code: 'GEL', name: 'Gel', group: 'CUTANEOUS' };

function ing(
  substance: string,
  amount: number | null,
  unit: string | null = 'mg',
  extra: Partial<ComparableIngredient> & { perAmount?: number; perUnit?: string } = {},
): ComparableIngredient {
  const { perAmount, perUnit, ...rest } = extra;
  return {
    substanceId: substance,
    substanceName: substance,
    moietyId: rest.moietyId ?? substance,
    moietyName: rest.moietyName ?? substance,
    strength: { amount, unit, perAmount, perUnit, basis: 'SUBSTANCE' },
    ...rest,
  };
}

function med(id: string, overrides: Partial<ComparableMedicine> = {}): ComparableMedicine {
  return {
    id,
    name: id,
    brand: id,
    manufacturer: 'Acme',
    countryCode: 'HU',
    atcCode: 'M01AE01',
    form: TABLET,
    route: 'ORAL',
    release: 'IMMEDIATE',
    prescription: 'OTC',
    packageSize: { quantity: 20, unit: 'tablet' },
    ingredients: [ing('ibuprofen', 400)],
    ...overrides,
  };
}

describe('normaliseStrength', () => {
  it('normalises per-dose-unit strengths to mg/unit', () => {
    expect(normaliseStrength(ing('x', 0.5, 'g'))).toEqual({ value: 500, unit: 'mg/unit', kind: 'strength' });
    expect(normaliseStrength(ing('x', 500, 'mcg'))).toEqual({ value: 0.5, unit: 'mg/unit', kind: 'strength' });
  });

  it('normalises liquid concentrations to mg/ml', () => {
    expect(normaliseStrength(ing('x', 200, 'mg', { perAmount: 5, perUnit: 'ml' }))).toEqual({
      value: 40,
      unit: 'mg/ml',
      kind: 'concentration',
    });
  });

  it('keeps percentages as their own dimension', () => {
    expect(normaliseStrength(ing('x', 5, '%'))).toEqual({ value: 5, unit: '%', kind: 'concentration' });
  });

  it('returns null for missing or unknown units instead of guessing', () => {
    expect(normaliseStrength(ing('x', null))).toBeNull();
    expect(normaliseStrength(ing('x', 10, 'spoonful'))).toBeNull();
  });
});

describe('single-ingredient products', () => {
  it('rates identical products as potentially equivalent, not interchangeable', () => {
    const r = comparePair(med('a'), med('b', { brand: 'Other', manufacturer: 'Other' }));
    expect(r.composition).toBe('SAME_ACTIVE_INGREDIENT');
    expect(r.assessment).toBe('POTENTIALLY_EQUIVALENT');
  });

  it('treats the same quantity written in different units as equal', () => {
    const r = comparePair(med('a'), med('b', { ingredients: [ing('ibuprofen', 0.4, 'g')] }));
    expect(r.assessment).toBe('POTENTIALLY_EQUIVALENT');
  });

  it('flags different quantities of the same ingredient', () => {
    const r = comparePair(med('a'), med('b', { ingredients: [ing('ibuprofen', 200)] }));
    expect(r.composition).toBe('SAME_ACTIVE_INGREDIENT');
    expect(r.assessment).toBe('IMPORTANT_DIFFERENCES');
    expect(r.differences).toContainEqual(
      expect.objectContaining({ code: 'DIFFERENT_STRENGTH', reference: '400 mg', other: '200 mg' }),
    );
  });

  it('reports no shared ingredients as not comparable', () => {
    const r = comparePair(med('a'), med('b', { ingredients: [ing('paracetamol', 500)] }));
    expect(r.composition).toBe('NO_SHARED_INGREDIENTS');
    expect(r.assessment).toBe('NOT_COMPARABLE');
  });
});

describe('multi-ingredient products', () => {
  const combo = med('combo', {
    ingredients: [ing('paracetamol', 500), ing('caffeine', 65)],
    atcCode: 'N02BE51',
  });

  it('never treats a combination as equivalent to one of its ingredients', () => {
    const single = med('single', { ingredients: [ing('paracetamol', 500)] });
    const r = comparePair(combo, single);
    expect(r.composition).toBe('SIMILAR_COMPOSITION');
    expect(r.assessment).toBe('IMPORTANT_DIFFERENCES');
    expect(r.differences[0]).toEqual(
      expect.objectContaining({ code: 'MISSING_INGREDIENT', severity: 'critical', substanceId: 'caffeine' }),
    );
  });

  it('reports additional ingredients in the other product', () => {
    const single = med('single', { ingredients: [ing('paracetamol', 500)] });
    const r = comparePair(single, combo);
    expect(r.differences).toContainEqual(
      expect.objectContaining({ code: 'ADDITIONAL_INGREDIENT', substanceId: 'caffeine' }),
    );
  });

  it('recognises the same combination with identical quantities', () => {
    const r = comparePair(combo, { ...combo, id: 'combo2', ingredients: [ing('caffeine', 65), ing('paracetamol', 500)] });
    expect(r.composition).toBe('SAME_COMBINATION');
    expect(r.assessment).toBe('POTENTIALLY_EQUIVALENT');
  });

  it('compares each ingredient independently', () => {
    const r = comparePair(combo, { ...combo, id: 'c2', ingredients: [ing('paracetamol', 500), ing('caffeine', 50)] });
    expect(r.composition).toBe('SAME_COMBINATION');
    expect(r.assessment).toBe('IMPORTANT_DIFFERENCES');
    const strength = r.differences.filter((d) => d.code === 'DIFFERENT_STRENGTH');
    expect(strength).toHaveLength(1);
    expect(strength[0]!.substanceId).toBe('caffeine');
  });

  it('rejects a product that lists the same ingredient twice', () => {
    expect(() =>
      comparePair(med('dup', { ingredients: [ing('ibuprofen', 200), ing('ibuprofen', 200)] }), med('b')),
    ).toThrow(/more than once/);
  });
});

describe('concentrations, forms, release and route', () => {
  it('compares liquid concentrations after normalisation', () => {
    const a = med('a', { form: SUSPENSION, ingredients: [ing('ibuprofen', 100, 'mg', { perAmount: 5, perUnit: 'ml' })] });
    const same = med('b', { form: SUSPENSION, ingredients: [ing('ibuprofen', 20, 'mg', { perAmount: 1, perUnit: 'ml' })] });
    const stronger = med('c', { form: SUSPENSION, ingredients: [ing('ibuprofen', 200, 'mg', { perAmount: 5, perUnit: 'ml' })] });
    expect(comparePair(a, same).assessment).toBe('POTENTIALLY_EQUIVALENT');
    const r = comparePair(a, stronger);
    expect(r.differences).toContainEqual(expect.objectContaining({ code: 'DIFFERENT_CONCENTRATION' }));
  });

  it('treats tablet vs film-coated tablet as a minor form variant', () => {
    const r = comparePair(med('a'), med('b', { form: FILM_TABLET }));
    expect(r.differences).toContainEqual(expect.objectContaining({ code: 'FORM_VARIANT', severity: 'minor' }));
    expect(r.assessment).toBe('POTENTIALLY_EQUIVALENT');
  });

  it('flags a different form group and incomparable strength units', () => {
    const r = comparePair(
      med('a'),
      med('b', { form: SUSPENSION, ingredients: [ing('ibuprofen', 100, 'mg', { perAmount: 5, perUnit: 'ml' })] }),
    );
    expect(r.assessment).toBe('IMPORTANT_DIFFERENCES');
    expect(r.differences.map((d) => d.code)).toEqual(
      expect.arrayContaining(['DIFFERENT_FORM', 'INCOMPARABLE_STRENGTH']),
    );
  });

  it('flags a different release mechanism as critical', () => {
    const r = comparePair(med('a'), med('b', { release: 'PROLONGED' }));
    expect(r.assessment).toBe('IMPORTANT_DIFFERENCES');
    expect(r.differences[0]).toEqual(expect.objectContaining({ code: 'DIFFERENT_RELEASE', severity: 'critical' }));
  });

  it('flags a different route of administration as critical', () => {
    const r = comparePair(
      med('a'),
      med('b', { route: 'CUTANEOUS', form: GEL, ingredients: [ing('ibuprofen', 5, '%')] }),
    );
    expect(r.differences.map((d) => d.code)).toEqual(expect.arrayContaining(['DIFFERENT_ROUTE', 'DIFFERENT_FORM']));
    expect(r.differences[0]!.severity).toBe('critical');
  });
});

describe('salts and moieties', () => {
  it('lines up salts of the same moiety but reports the salt difference', () => {
    const lysine = ing('ibuprofen lysine', 684, 'mg', { moietyId: 'ibuprofen', moietyName: 'ibuprofen' });
    const r = comparePair(med('a'), med('b', { ingredients: [lysine] }));
    expect(r.composition).toBe('SAME_ACTIVE_INGREDIENT');
    expect(r.assessment).toBe('IMPORTANT_DIFFERENCES');
    expect(r.differences).toContainEqual(expect.objectContaining({ code: 'DIFFERENT_SALT' }));
  });
});

describe('missing data', () => {
  it('does not treat unknown strength as equal', () => {
    const r = comparePair(med('a'), med('b', { ingredients: [ing('ibuprofen', null, null)] }));
    expect(r.assessment).toBe('INSUFFICIENT_DATA');
  });

  it('does not treat unknown route or release as equal', () => {
    expect(comparePair(med('a'), med('b', { route: null })).assessment).toBe('INSUFFICIENT_DATA');
    expect(comparePair(med('a'), med('b', { release: 'UNKNOWN' })).assessment).toBe('INSUFFICIENT_DATA');
    expect(comparePair(med('a'), med('b', { form: null })).assessment).toBe('INSUFFICIENT_DATA');
  });

  it('lets known important differences win over unknowns', () => {
    const r = comparePair(med('a'), med('b', { route: null, release: 'PROLONGED' }));
    expect(r.assessment).toBe('IMPORTANT_DIFFERENCES');
  });

  it('handles products without any ingredient data', () => {
    const r = comparePair(med('a'), med('b', { ingredients: [] }));
    expect(r.assessment).toBe('NOT_COMPARABLE');
  });
});

describe('country-specific variations', () => {
  it('reports registration country and prescription status as informational', () => {
    const r = comparePair(med('a'), med('b', { countryCode: 'DE', prescription: 'PHARMACY_ONLY' }));
    expect(r.assessment).toBe('POTENTIALLY_EQUIVALENT');
    expect(r.differences.map((d) => [d.code, d.severity])).toEqual(
      expect.arrayContaining([
        ['DIFFERENT_COUNTRY', 'info'],
        ['DIFFERENT_PRESCRIPTION_STATUS', 'info'],
      ]),
    );
  });
});

describe('compareMedicines', () => {
  it('requires 2–6 distinct medicines', () => {
    expect(() => compareMedicines([med('a')])).toThrow();
    expect(() => compareMedicines([med('a'), med('a')])).toThrow(/itself/);
    expect(() => compareMedicines(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => med(id)))).toThrow();
  });

  it('builds an ingredient matrix with per-cell status', () => {
    const res = compareMedicines([
      med('a', { ingredients: [ing('paracetamol', 500), ing('caffeine', 65)] }),
      med('b', { ingredients: [ing('paracetamol', 500)] }),
      med('c', { ingredients: [ing('paracetamol', 1, 'g'), ing('caffeine', 65), ing('ascorbic acid', 100)] }),
    ]);
    const rows = Object.fromEntries(res.ingredientRows.map((r) => [r.key, r]));
    expect(rows['paracetamol']!.cells.map((c) => c.status)).toEqual(['REFERENCE', 'SAME', 'DIFFERENT_QUANTITY']);
    expect(rows['caffeine']!.cells.map((c) => c.status)).toEqual(['REFERENCE', 'MISSING', 'SAME']);
    expect(rows['ascorbic acid']!.cells.map((c) => c.status)).toEqual(['REFERENCE', 'MISSING', 'ADDITIONAL']);
    expect(rows['paracetamol']!.allSame).toBe(false);
    expect(res.summary.assessment).toBe('IMPORTANT_DIFFERENCES');
    expect(res.summary.composition).toBe('SIMILAR_COMPOSITION');
    expect(res.summary.criticalCount).toBeGreaterThanOrEqual(2);
  });

  it('marks attribute rows that differ', () => {
    const res = compareMedicines([med('a'), med('b', { release: 'PROLONGED' })]);
    const release = res.attributeRows.find((r) => r.key === 'release')!;
    const route = res.attributeRows.find((r) => r.key === 'route')!;
    expect(release.allSame).toBe(false);
    expect(route.allSame).toBe(true);
    expect(res.disclaimerKey).toBe('compare.disclaimer');
  });

  it('treats duplicate products from different countries as potentially equivalent', () => {
    const res = compareMedicines([med('hu'), med('at', { countryCode: 'AT', brand: 'Other brand' })]);
    expect(res.summary.assessment).toBe('POTENTIALLY_EQUIVALENT');
  });
});
