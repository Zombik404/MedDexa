/**
 * Everyday categories shown on the home screen. Each one is defined only by WHO ATC prefixes
 * (an official classification), so a medicine lands in a category because of its registered
 * ATC code — never because of a guess from its name. Labels live in the app's translations
 * (`category.<slug>`).
 */
export interface MedicineCategory {
  slug: string;
  /** Icon key understood by the mobile app. */
  icon: string;
  atcPrefixes: string[];
}

export const MEDICINE_CATEGORIES: readonly MedicineCategory[] = [
  { slug: 'pain', icon: 'pain', atcPrefixes: ['N02', 'M01A', 'M02A'] },
  { slug: 'cold', icon: 'cold', atcPrefixes: ['R05', 'R01', 'R02'] },
  { slug: 'allergy', icon: 'allergy', atcPrefixes: ['R06'] },
  { slug: 'digestion', icon: 'digestion', atcPrefixes: ['A02', 'A03', 'A06', 'A07', 'A09'] },
  { slug: 'skin', icon: 'skin', atcPrefixes: ['D'] },
  { slug: 'vitamins', icon: 'vitamins', atcPrefixes: ['A11', 'A12', 'B03'] },
  { slug: 'heart', icon: 'heart', atcPrefixes: ['C'] },
  { slug: 'sleep', icon: 'sleep', atcPrefixes: ['N05B', 'N05C'] },
  { slug: 'eyes-ears', icon: 'eyes', atcPrefixes: ['S'] },
  { slug: 'antibiotics', icon: 'antibiotics', atcPrefixes: ['J01'] },
  { slug: 'diabetes', icon: 'diabetes', atcPrefixes: ['A10'] },
  { slug: 'womens-health', icon: 'women', atcPrefixes: ['G01', 'G02', 'G03'] },
];

export function categoryBySlug(slug: string): MedicineCategory | undefined {
  return MEDICINE_CATEGORIES.find((c) => c.slug === slug);
}

/** Categories an ATC code belongs to (a code can sit in at most one by construction). */
export function categoryForAtc(atc: string | null | undefined): MedicineCategory | undefined {
  if (!atc) return undefined;
  const code = atc.toUpperCase();
  return MEDICINE_CATEGORIES.find((c) => c.atcPrefixes.some((p) => code.startsWith(p)));
}
