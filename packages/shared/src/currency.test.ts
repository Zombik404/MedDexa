import { MissingRateError, convert, pricePerUnit, roundMoney, type RateTable } from './currency';
import { normaliseQuantity, quantitiesEqual } from './units';

const table: RateTable = { base: 'EUR', date: '2026-11-20', source: 'test', rates: { HUF: 400, PLN: 4.25 } };

describe('currency', () => {
  it('converts via EUR', () => {
    expect(convert(4000, 'HUF', 'EUR', table)).toBeCloseTo(10);
    expect(convert(10, 'EUR', 'PLN', table)).toBeCloseTo(42.5);
    expect(convert(4000, 'HUF', 'PLN', table)).toBeCloseTo(42.5);
    expect(convert(5, 'EUR', 'EUR', table)).toBe(5);
  });

  it('throws on missing rates rather than inventing one', () => {
    expect(() => convert(1, 'EUR', 'CZK', table)).toThrow(MissingRateError);
  });

  it('rounds HUF to whole forints and EUR to cents', () => {
    expect(roundMoney(1234.56, 'HUF')).toBe(1235);
    expect(roundMoney(1.005 + 0.0001, 'EUR')).toBe(1.01);
  });

  it('computes price per unit only when meaningful', () => {
    expect(pricePerUnit(10, { quantity: 20, unit: 'tablet' })).toEqual({ value: 0.5, per: 'tablet' });
    expect(pricePerUnit(10, null)).toBeNull();
    expect(pricePerUnit(10, { quantity: 0, unit: 'ml' })).toBeNull();
  });
});

describe('units', () => {
  it('normalises micro sign variants', () => {
    expect(normaliseQuantity(1000, 'μg')?.value).toBe(1);
    expect(normaliseQuantity(1000, 'µg')?.value).toBe(1);
    expect(normaliseQuantity(2, 'tablets')?.dimension).toBe('count');
  });
  it('compares with a relative tolerance', () => {
    expect(quantitiesEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(quantitiesEqual(400, 400.5)).toBe(false);
  });
});
