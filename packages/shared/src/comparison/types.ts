export type ReleaseMechanism =
  | 'IMMEDIATE'
  | 'MODIFIED'
  | 'PROLONGED'
  | 'DELAYED'
  | 'GASTRO_RESISTANT'
  | 'UNKNOWN';

export type PrescriptionStatus = 'RX' | 'OTC' | 'PHARMACY_ONLY' | 'UNKNOWN';

/** How an ingredient quantity is expressed: as the stated salt/ester, or as the active moiety. */
export type StrengthBasis = 'SUBSTANCE' | 'MOIETY';

export interface ComparableStrength {
  amount: number | null;
  unit: string | null;
  /** Reference quantity the amount refers to, e.g. 5 (ml). Defaults to 1 dose unit. */
  perAmount?: number | null;
  perUnit?: string | null;
  basis?: StrengthBasis;
}

export interface ComparableIngredient {
  /** Canonical substance, e.g. "ibuprofen lysine". */
  substanceId: string;
  substanceName: string;
  /** Active moiety, e.g. "ibuprofen". Used to recognise salts of the same moiety. */
  moietyId?: string | null;
  moietyName?: string | null;
  strength: ComparableStrength;
}

export interface ComparableForm {
  code: string;
  name: string;
  /** Broader group such as ORAL_SOLID, ORAL_LIQUID, CUTANEOUS, PARENTERAL. */
  group: string | null;
}

export interface ComparableMedicine {
  id: string;
  name: string;
  brand?: string | null;
  manufacturer?: string | null;
  countryCode?: string | null;
  atcCode?: string | null;
  form: ComparableForm | null;
  route: string | null;
  release: ReleaseMechanism | null;
  prescription: PrescriptionStatus;
  packageSize: { quantity: number; unit: string } | null;
  ingredients: ComparableIngredient[];
}

export type IngredientStatus =
  | 'SAME'
  | 'DIFFERENT_QUANTITY'
  | 'DIFFERENT_CONCENTRATION'
  | 'DIFFERENT_SALT'
  | 'INCOMPARABLE_UNITS'
  | 'UNKNOWN_QUANTITY'
  | 'MISSING'
  | 'ADDITIONAL';

export type DifferenceCode =
  | 'MISSING_INGREDIENT'
  | 'ADDITIONAL_INGREDIENT'
  | 'DIFFERENT_STRENGTH'
  | 'DIFFERENT_CONCENTRATION'
  | 'DIFFERENT_SALT'
  | 'INCOMPARABLE_STRENGTH'
  | 'UNKNOWN_STRENGTH'
  | 'DIFFERENT_FORM'
  | 'FORM_VARIANT'
  | 'UNKNOWN_FORM'
  | 'DIFFERENT_RELEASE'
  | 'UNKNOWN_RELEASE'
  | 'DIFFERENT_ROUTE'
  | 'UNKNOWN_ROUTE'
  | 'DIFFERENT_PRESCRIPTION_STATUS'
  | 'DIFFERENT_PACKAGE_SIZE'
  | 'DIFFERENT_COUNTRY';

export type Severity = 'critical' | 'major' | 'minor' | 'info';

export interface Difference {
  code: DifferenceCode;
  severity: Severity;
  /** Ingredient the difference relates to, when applicable. */
  substanceId?: string;
  reference?: string | null;
  other?: string | null;
}

export type CompositionClass =
  | 'SAME_ACTIVE_INGREDIENT'
  | 'SAME_COMBINATION'
  | 'SIMILAR_COMPOSITION'
  | 'NO_SHARED_INGREDIENTS';

export type Assessment =
  | 'POTENTIALLY_EQUIVALENT'
  | 'IMPORTANT_DIFFERENCES'
  | 'INSUFFICIENT_DATA'
  | 'NOT_COMPARABLE';

export interface IngredientCell {
  present: boolean;
  substanceId?: string;
  substanceName?: string;
  /** Human-readable strength as stored, e.g. "200 mg / 5 ml". */
  display: string | null;
  /** Normalised strength, e.g. 40 with unit "mg/ml". */
  normalised: { value: number; unit: string } | null;
  status: IngredientStatus | 'REFERENCE';
}

export interface IngredientRow {
  /** Matching key: active moiety when known, otherwise the substance. */
  key: string;
  name: string;
  cells: IngredientCell[];
  allSame: boolean;
}

export interface AttributeRow {
  key:
    | 'brand'
    | 'manufacturer'
    | 'country'
    | 'form'
    | 'route'
    | 'release'
    | 'prescription'
    | 'packageSize'
    | 'atcCode';
  values: (string | null)[];
  allSame: boolean;
}

export interface PairComparison {
  referenceId: string;
  otherId: string;
  composition: CompositionClass;
  assessment: Assessment;
  differences: Difference[];
}

export interface ComparisonResult {
  medicineIds: string[];
  referenceId: string;
  ingredientRows: IngredientRow[];
  attributeRows: AttributeRow[];
  pairs: PairComparison[];
  summary: {
    composition: CompositionClass;
    assessment: Assessment;
    criticalCount: number;
    majorCount: number;
  };
  /** Always shown to the user next to a comparison. */
  disclaimerKey: 'compare.disclaimer';
}
