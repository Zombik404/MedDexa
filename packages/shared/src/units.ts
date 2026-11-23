/**
 * Unit normalisation for pharmaceutical quantities.
 *
 * Quantities are only ever compared inside the same dimension. A value in
 * international units (IU) is never converted to a mass, because the
 * conversion is substance-specific and must come from official documentation.
 */

export type Dimension = 'mass' | 'volume' | 'activity' | 'amount' | 'count' | 'percent';

interface UnitDef {
  dimension: Dimension;
  /** Factor to convert to the dimension's base unit (mg, ml, IU, mmol, unit, %). */
  factor: number;
}

const UNITS: Record<string, UnitDef> = {
  // mass → mg
  kg: { dimension: 'mass', factor: 1_000_000 },
  g: { dimension: 'mass', factor: 1000 },
  mg: { dimension: 'mass', factor: 1 },
  mcg: { dimension: 'mass', factor: 0.001 },
  µg: { dimension: 'mass', factor: 0.001 },
  ug: { dimension: 'mass', factor: 0.001 },
  ng: { dimension: 'mass', factor: 0.000001 },
  // volume → ml
  l: { dimension: 'volume', factor: 1000 },
  dl: { dimension: 'volume', factor: 100 },
  ml: { dimension: 'volume', factor: 1 },
  // biological activity → IU
  iu: { dimension: 'activity', factor: 1 },
  kiu: { dimension: 'activity', factor: 1000 },
  miu: { dimension: 'activity', factor: 1_000_000 },
  // amount of substance → mmol
  mol: { dimension: 'amount', factor: 1000 },
  mmol: { dimension: 'amount', factor: 1 },
  // countable dose units → unit
  unit: { dimension: 'count', factor: 1 },
  tablet: { dimension: 'count', factor: 1 },
  capsule: { dimension: 'count', factor: 1 },
  dose: { dimension: 'count', factor: 1 },
  sachet: { dimension: 'count', factor: 1 },
  patch: { dimension: 'count', factor: 1 },
  ampoule: { dimension: 'count', factor: 1 },
  vial: { dimension: 'count', factor: 1 },
  suppository: { dimension: 'count', factor: 1 },
  // percent (w/w, w/v) kept as a dimension of its own
  '%': { dimension: 'percent', factor: 1 },
};

export function normaliseUnitCode(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u === 'μg') return 'µg'; // greek mu vs micro sign
  if (u === 'i.u.' || u === 'ie' || u === 'ne' || u === 'ui') return 'iu';
  if (u.endsWith('s') && UNITS[u.slice(0, -1)]?.dimension === 'count') return u.slice(0, -1);
  return u;
}

export function unitInfo(unit: string): UnitDef | undefined {
  return UNITS[normaliseUnitCode(unit)];
}

export function baseUnitOf(dimension: Dimension): string {
  switch (dimension) {
    case 'mass':
      return 'mg';
    case 'volume':
      return 'ml';
    case 'activity':
      return 'IU';
    case 'amount':
      return 'mmol';
    case 'count':
      return 'unit';
    case 'percent':
      return '%';
  }
}

export interface NormalisedQuantity {
  value: number;
  dimension: Dimension;
  baseUnit: string;
}

/** Converts a quantity to its dimension's base unit. Returns null for unknown units. */
export function normaliseQuantity(value: number, unit: string): NormalisedQuantity | null {
  const def = unitInfo(unit);
  if (!def || !Number.isFinite(value)) return null;
  return { value: roundSig(value * def.factor), dimension: def.dimension, baseUnit: baseUnitOf(def.dimension) };
}

/** Rounds to 10 significant digits to remove floating-point noise from unit factors. */
export function roundSig(n: number, digits = 10): number {
  if (n === 0 || !Number.isFinite(n)) return n;
  return Number(n.toPrecision(digits));
}

/** Relative tolerance used when deciding whether two normalised quantities are equal. */
export const QUANTITY_EPSILON = 1e-9;

export function quantitiesEqual(a: number, b: number): boolean {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * QUANTITY_EPSILON;
}
