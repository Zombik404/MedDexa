import { normaliseQuantity, quantitiesEqual, roundSig } from '../units';
import type {
  Assessment,
  AttributeRow,
  ComparableIngredient,
  ComparableMedicine,
  ComparisonResult,
  CompositionClass,
  Difference,
  IngredientCell,
  IngredientRow,
  IngredientStatus,
  PairComparison,
  Severity,
} from './types';

/**
 * MedDexa comparison engine.
 *
 * Design rules (see docs/COMPARISON_ENGINE.md):
 *  - Ingredients are matched by active moiety, so salts of the same moiety line up
 *    in one row, but a salt difference is always reported.
 *  - Sharing an ingredient never makes two products equivalent. Equivalence also
 *    requires the same full ingredient set, identical normalised strengths, the same
 *    route, the same release mechanism and the same form group, with no unknowns.
 *  - Unknown data is never treated as "equal"; it downgrades the assessment to
 *    INSUFFICIENT_DATA.
 *  - The result describes pharmaceutical characteristics only. It never recommends
 *    substituting a medicine.
 */

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 6;

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, major: 2, minor: 1, info: 0 };

export function ingredientKey(i: ComparableIngredient): string {
  return i.moietyId ?? i.substanceId;
}

function ingredientDisplayName(i: ComparableIngredient): string {
  return i.moietyName ?? i.substanceName;
}

export interface NormalisedStrength {
  value: number;
  /** e.g. "mg/unit", "mg/ml", "IU/unit", "%" */
  unit: string;
  /** Liquid/semi-solid concentrations are "concentration"; per dose unit is "strength". */
  kind: 'strength' | 'concentration';
}

/** Normalises an ingredient strength to base units per base unit (mg/unit, mg/ml …). */
export function normaliseStrength(i: ComparableIngredient): NormalisedStrength | null {
  const s = i.strength;
  if (s.amount == null || !s.unit) return null;
  const amount = normaliseQuantity(s.amount, s.unit);
  if (!amount) return null;
  if (amount.dimension === 'percent') {
    return { value: amount.value, unit: '%', kind: 'concentration' };
  }
  const perAmount = s.perAmount ?? 1;
  const perUnit = s.perUnit ?? 'unit';
  const per = normaliseQuantity(perAmount, perUnit);
  if (!per || per.value === 0) return null;
  const kind = per.dimension === 'count' ? 'strength' : 'concentration';
  return {
    value: roundSig(amount.value / per.value),
    unit: `${amount.baseUnit}/${per.baseUnit}`,
    kind,
  };
}

export function formatStrength(i: ComparableIngredient): string | null {
  const s = i.strength;
  if (s.amount == null || !s.unit) return null;
  const base = `${trimNumber(s.amount)} ${s.unit}`;
  if (s.perAmount != null && s.perUnit && !(s.perAmount === 1 && isCountUnit(s.perUnit))) {
    return `${base} / ${trimNumber(s.perAmount)} ${s.perUnit}`;
  }
  return base;
}

function isCountUnit(u: string): boolean {
  return normaliseQuantity(1, u)?.dimension === 'count';
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(roundSig(n, 6));
}

interface IngredientPairResult {
  status: IngredientStatus;
  difference?: Difference;
}

function compareIngredient(
  ref: ComparableIngredient,
  other: ComparableIngredient,
): IngredientPairResult {
  const key = ingredientKey(ref);
  const refDisplay = formatStrength(ref);
  const otherDisplay = formatStrength(other);

  if (ref.substanceId !== other.substanceId) {
    // Same moiety, different salt/ester. Quantities are only comparable when both are
    // expressed as the moiety; the salt difference is reported either way.
    return {
      status: 'DIFFERENT_SALT',
      difference: {
        code: 'DIFFERENT_SALT',
        severity: 'major',
        substanceId: key,
        reference: ref.substanceName,
        other: other.substanceName,
      },
    };
  }

  const a = normaliseStrength(ref);
  const b = normaliseStrength(other);
  if (!a || !b) {
    return {
      status: 'UNKNOWN_QUANTITY',
      difference: {
        code: 'UNKNOWN_STRENGTH',
        severity: 'major',
        substanceId: key,
        reference: refDisplay,
        other: otherDisplay,
      },
    };
  }
  if (a.unit !== b.unit) {
    return {
      status: 'INCOMPARABLE_UNITS',
      difference: {
        code: 'INCOMPARABLE_STRENGTH',
        severity: 'major',
        substanceId: key,
        reference: refDisplay,
        other: otherDisplay,
      },
    };
  }
  if ((ref.strength.basis ?? 'SUBSTANCE') !== (other.strength.basis ?? 'SUBSTANCE')) {
    return {
      status: 'INCOMPARABLE_UNITS',
      difference: {
        code: 'INCOMPARABLE_STRENGTH',
        severity: 'major',
        substanceId: key,
        reference: refDisplay,
        other: otherDisplay,
      },
    };
  }
  if (quantitiesEqual(a.value, b.value)) return { status: 'SAME' };

  const concentration = a.kind === 'concentration';
  return {
    status: concentration ? 'DIFFERENT_CONCENTRATION' : 'DIFFERENT_QUANTITY',
    difference: {
      code: concentration ? 'DIFFERENT_CONCENTRATION' : 'DIFFERENT_STRENGTH',
      severity: 'major',
      substanceId: key,
      reference: refDisplay,
      other: otherDisplay,
    },
  };
}

function indexIngredients(m: ComparableMedicine): Map<string, ComparableIngredient> {
  const map = new Map<string, ComparableIngredient>();
  for (const i of m.ingredients) {
    const key = ingredientKey(i);
    if (map.has(key)) {
      throw new Error(`Medicine ${m.id} lists ingredient "${key}" more than once`);
    }
    map.set(key, i);
  }
  return map;
}

export function compareComposition(
  refKeys: Set<string>,
  otherKeys: Set<string>,
): CompositionClass {
  const shared = [...refKeys].filter((k) => otherKeys.has(k));
  if (shared.length === 0) return 'NO_SHARED_INGREDIENTS';
  const sameSet = shared.length === refKeys.size && shared.length === otherKeys.size;
  if (!sameSet) return 'SIMILAR_COMPOSITION';
  return refKeys.size === 1 ? 'SAME_ACTIVE_INGREDIENT' : 'SAME_COMBINATION';
}

/** Compares one product against a reference product. */
export function comparePair(ref: ComparableMedicine, other: ComparableMedicine): PairComparison {
  const refIdx = indexIngredients(ref);
  const otherIdx = indexIngredients(other);
  const differences: Difference[] = [];

  const composition =
    refIdx.size === 0 || otherIdx.size === 0
      ? 'NO_SHARED_INGREDIENTS'
      : compareComposition(new Set(refIdx.keys()), new Set(otherIdx.keys()));

  for (const [key, ri] of refIdx) {
    const oi = otherIdx.get(key);
    if (!oi) {
      differences.push({
        code: 'MISSING_INGREDIENT',
        severity: 'critical',
        substanceId: key,
        reference: ingredientDisplayName(ri),
        other: null,
      });
      continue;
    }
    const r = compareIngredient(ri, oi);
    if (r.difference) differences.push(r.difference);
  }
  for (const [key, oi] of otherIdx) {
    if (!refIdx.has(key)) {
      differences.push({
        code: 'ADDITIONAL_INGREDIENT',
        severity: 'critical',
        substanceId: key,
        reference: null,
        other: ingredientDisplayName(oi),
      });
    }
  }

  // Route of administration
  if (!ref.route || !other.route) {
    differences.push({ code: 'UNKNOWN_ROUTE', severity: 'major', reference: ref.route, other: other.route });
  } else if (ref.route !== other.route) {
    differences.push({ code: 'DIFFERENT_ROUTE', severity: 'critical', reference: ref.route, other: other.route });
  }

  // Release mechanism
  const rr = ref.release && ref.release !== 'UNKNOWN' ? ref.release : null;
  const or = other.release && other.release !== 'UNKNOWN' ? other.release : null;
  if (!rr || !or) {
    differences.push({ code: 'UNKNOWN_RELEASE', severity: 'major', reference: rr, other: or });
  } else if (rr !== or) {
    differences.push({ code: 'DIFFERENT_RELEASE', severity: 'critical', reference: rr, other: or });
  }

  // Pharmaceutical form
  if (!ref.form || !other.form) {
    differences.push({
      code: 'UNKNOWN_FORM',
      severity: 'major',
      reference: ref.form?.name ?? null,
      other: other.form?.name ?? null,
    });
  } else if (ref.form.code !== other.form.code) {
    const sameGroup = ref.form.group != null && ref.form.group === other.form.group;
    differences.push({
      code: sameGroup ? 'FORM_VARIANT' : 'DIFFERENT_FORM',
      severity: sameGroup ? 'minor' : 'major',
      reference: ref.form.name,
      other: other.form.name,
    });
  }

  if (ref.prescription !== other.prescription) {
    differences.push({
      code: 'DIFFERENT_PRESCRIPTION_STATUS',
      severity: 'info',
      reference: ref.prescription,
      other: other.prescription,
    });
  }

  const rp = ref.packageSize ? `${ref.packageSize.quantity} ${ref.packageSize.unit}` : null;
  const op = other.packageSize ? `${other.packageSize.quantity} ${other.packageSize.unit}` : null;
  if (rp !== op) {
    differences.push({ code: 'DIFFERENT_PACKAGE_SIZE', severity: 'info', reference: rp, other: op });
  }

  if ((ref.countryCode ?? null) !== (other.countryCode ?? null)) {
    differences.push({
      code: 'DIFFERENT_COUNTRY',
      severity: 'info',
      reference: ref.countryCode ?? null,
      other: other.countryCode ?? null,
    });
  }

  differences.sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity]);

  return {
    referenceId: ref.id,
    otherId: other.id,
    composition,
    assessment: assess(composition, differences),
    differences,
  };
}

const UNKNOWN_CODES = new Set([
  'UNKNOWN_STRENGTH',
  'UNKNOWN_ROUTE',
  'UNKNOWN_RELEASE',
  'UNKNOWN_FORM',
  'INCOMPARABLE_STRENGTH',
]);

function assess(composition: CompositionClass, differences: Difference[]): Assessment {
  if (composition === 'NO_SHARED_INGREDIENTS') return 'NOT_COMPARABLE';
  const known = differences.filter((d) => !UNKNOWN_CODES.has(d.code));
  if (known.some((d) => d.severity === 'critical' || d.severity === 'major')) {
    return 'IMPORTANT_DIFFERENCES';
  }
  if (differences.some((d) => UNKNOWN_CODES.has(d.code))) return 'INSUFFICIENT_DATA';
  return 'POTENTIALLY_EQUIVALENT';
}

const ASSESSMENT_RANK: Record<Assessment, number> = {
  POTENTIALLY_EQUIVALENT: 0,
  INSUFFICIENT_DATA: 1,
  IMPORTANT_DIFFERENCES: 2,
  NOT_COMPARABLE: 3,
};
const COMPOSITION_RANK: Record<CompositionClass, number> = {
  SAME_ACTIVE_INGREDIENT: 0,
  SAME_COMBINATION: 0,
  SIMILAR_COMPOSITION: 1,
  NO_SHARED_INGREDIENTS: 2,
};

/**
 * Compares 2–6 medicines. The first medicine is the reference; every other medicine is
 * compared against it, and the matrices highlight cells that differ from the reference.
 */
export function compareMedicines(medicines: ComparableMedicine[]): ComparisonResult {
  if (medicines.length < MIN_COMPARE) {
    throw new Error(`At least ${MIN_COMPARE} medicines are required for a comparison`);
  }
  if (medicines.length > MAX_COMPARE) {
    throw new Error(`At most ${MAX_COMPARE} medicines can be compared at once`);
  }
  const ids = medicines.map((m) => m.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('The same medicine cannot be compared with itself');
  }

  const [reference, ...others] = medicines as [ComparableMedicine, ...ComparableMedicine[]];
  const pairs = others.map((o) => comparePair(reference, o));
  const indexes = medicines.map(indexIngredients);

  // Union of ingredient keys, reference order first.
  const keys: string[] = [];
  const names = new Map<string, string>();
  for (const idx of indexes) {
    for (const [k, i] of idx) {
      if (!names.has(k)) {
        keys.push(k);
        names.set(k, ingredientDisplayName(i));
      }
    }
  }

  const refIdx = indexes[0]!;
  const ingredientRows: IngredientRow[] = keys.map((key) => {
    const refIng = refIdx.get(key);
    const cells: IngredientCell[] = indexes.map((idx, col) => {
      const ing = idx.get(key);
      if (!ing) {
        return { present: false, display: null, normalised: null, status: col === 0 ? 'REFERENCE' : 'MISSING' };
      }
      const n = normaliseStrength(ing);
      let status: IngredientCell['status'];
      if (col === 0) status = 'REFERENCE';
      else if (!refIng) status = 'ADDITIONAL';
      else status = compareIngredient(refIng, ing).status;
      return {
        present: true,
        substanceId: ing.substanceId,
        substanceName: ing.substanceName,
        display: formatStrength(ing),
        normalised: n ? { value: n.value, unit: n.unit } : null,
        status,
      };
    });
    const allSame =
      cells.every((c) => c.present) &&
      cells.slice(1).every((c) => c.status === 'SAME');
    return { key, name: names.get(key)!, cells, allSame };
  });

  const attr = (key: AttributeRow['key'], pick: (m: ComparableMedicine) => string | null) => {
    const values = medicines.map(pick);
    return { key, values, allSame: values.every((v) => v === values[0]) };
  };
  const attributeRows: AttributeRow[] = [
    attr('brand', (m) => m.brand ?? null),
    attr('manufacturer', (m) => m.manufacturer ?? null),
    attr('country', (m) => m.countryCode ?? null),
    attr('atcCode', (m) => m.atcCode ?? null),
    attr('form', (m) => m.form?.name ?? null),
    attr('route', (m) => m.route),
    attr('release', (m) => m.release),
    attr('prescription', (m) => m.prescription),
    attr('packageSize', (m) =>
      m.packageSize ? `${m.packageSize.quantity} ${m.packageSize.unit}` : null,
    ),
  ];

  const all = pairs.flatMap((p) => p.differences);
  const worstAssessment = pairs.reduce<Assessment>(
    (w, p) => (ASSESSMENT_RANK[p.assessment] > ASSESSMENT_RANK[w] ? p.assessment : w),
    'POTENTIALLY_EQUIVALENT',
  );
  const worstComposition = pairs.reduce<CompositionClass>(
    (w, p) => (COMPOSITION_RANK[p.composition] > COMPOSITION_RANK[w] ? p.composition : w),
    pairs[0]!.composition,
  );

  return {
    medicineIds: ids,
    referenceId: reference.id,
    ingredientRows,
    attributeRows,
    pairs,
    summary: {
      composition: worstComposition,
      assessment: worstAssessment,
      criticalCount: all.filter((d) => d.severity === 'critical').length,
      majorCount: all.filter((d) => d.severity === 'major').length,
    },
    disclaimerKey: 'compare.disclaimer',
  };
}
