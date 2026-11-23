import { normalizeText } from '@meddexa/shared';

/** Keyword rules mapping national pharmaceutical form names (FR/ES/DE/EN/HU/IT) to MedDexa form codes. */
const FORM_RULES: [RegExp, string][] = [
  [/efervescen|effervescen|pezsgo|brause/, 'EFFERVESCENT_TABLET'],
  [/orodispers|bucodispers|szajban diszpergal/, 'ORODISPERSIBLE_TABLET'],
  [/liberation prolongee|liberacion prolongada|prolonged|retard|nyujtott/, 'PROLONGED_RELEASE_TABLET'],
  [/gastro.?resist|gastrorresist|magensaftresist|gyomornedv/, 'GASTRO_RESISTANT_TABLET'],
  [/pellicul|recubierto con pelicula|film.?coated|filmtabl|filmtablett|rivestit/, 'FILM_COATED_TABLET'],
  [/gelule|capsula dura|hartkapsel|capsule, hard|kemeny kapszula/, 'CAPSULE_HARD'],
  [/capsule molle|capsula blanda|weichkapsel|capsule, soft|lagy kapszula/, 'CAPSULE_SOFT'],
  [/suspension buvable|suspension oral|suspension orale|oral suspension|suszpenzio/, 'ORAL_SUSPENSION'],
  [/solution buvable|solucion oral|oral solution|losung zum einnehmen|belsoleges oldat/, 'ORAL_SOLUTION'],
  [/sirop|jarabe|syrup|szirup|sirup/, 'SYRUP'],
  [/granul/, 'GRANULES'],
  [/collyre|colirio|eye drops|augentropfen|szemcsepp/, 'EYE_DROPS'],
  [/pulverisation nasale|nebulizador nasal|nasal spray|nasenspray|orrspray/, 'NASAL_SPRAY'],
  [/suppositoire|supositorio|suppositor|kup/, 'SUPPOSITORY'],
  [/dispositif transdermique|parche transdermico|transdermal|tapasz/, 'TRANSDERMAL_PATCH'],
  [/injectable|inyectable|injection|injektion/, 'SOLUTION_FOR_INJECTION'],
  [/\bgel\b|\bgél\b/, 'GEL'],
  [/creme|crema|cream|krem/, 'CREAM'],
  [/pommade|pomada|ointment|salbe|kenocs/, 'OINTMENT'],
  [/comprime|comprimido|tablet|tablette|tabletta|compress/, 'TABLET'],
];

export function mapFormCode(localName: string | null | undefined): string | null {
  if (!localName) return null;
  const n = normalizeText(localName);
  for (const [re, code] of FORM_RULES) if (re.test(n)) return code;
  return null;
}

export function releaseFromForm(formCode: string | null, localName?: string | null) {
  const n = normalizeText(localName ?? '');
  if (formCode === 'PROLONGED_RELEASE_TABLET') return 'PROLONGED' as const;
  if (formCode === 'GASTRO_RESISTANT_TABLET' || formCode === 'GASTRO_RESISTANT_CAPSULE') return 'GASTRO_RESISTANT' as const;
  if (/liberation modifiee|liberacion modificada|modified/.test(n)) return 'MODIFIED' as const;
  if (formCode) return 'IMMEDIATE' as const;
  return 'UNKNOWN' as const;
}

const ROUTE_RULES: [RegExp, string][] = [
  [/orale|\boral\b|bucal|sublingu/, 'ORAL'],
  [/transderm/, 'TRANSDERMAL'],
  [/cutane|topica|cutanea|dermal/, 'CUTANEOUS'],
  [/intraveine|intravenos/, 'INTRAVENOUS'],
  [/intramuscul/, 'INTRAMUSCULAR'],
  [/sous-cutane|subcutane/, 'SUBCUTANEOUS'],
  [/ophtalm|oftalm|ocular/, 'OCULAR'],
  [/nasale|nasal/, 'NASAL'],
  [/rectale|rectal/, 'RECTAL'],
  [/inhal/, 'INHALATION'],
];

export function mapRoute(local: string | null | undefined): string | null {
  if (!local) return null;
  const n = normalizeText(local);
  for (const [re, code] of ROUTE_RULES) if (re.test(n)) return code;
  return null;
}

export interface ParsedDose {
  amount: number;
  unit: string;
}

/** Parses "500 mg", "1,16 g", "100 000 UI", "0.5mg" → { amount, unit }. */
export function parseDose(input: string | null | undefined): ParsedDose | null {
  if (!input) return null;
  const m = input
    .replace(/ /g, ' ')
    .trim()
    .match(/^(\d+(?:[ .]\d{3})*(?:[.,]\d+)?)\s*(mg|g|µg|μg|mcg|microgrammes?|ml|ui|iu|u\.i\.|%|mmol)\b/i);
  if (!m) return null;
  const amount = Number(m[1]!.replace(/ (?=\d{3})/g, '').replace(',', '.'));
  let unit = m[2]!.toLowerCase();
  if (unit.startsWith('microgramme') || unit === 'μg') unit = 'µg';
  if (unit === 'ui' || unit === 'u.i.') unit = 'IU';
  return Number.isFinite(amount) ? { amount, unit } : null;
}

/** Parses a dosage reference such as "un comprimé", "5 ml de suspension", "100 g de gel". */
export function parseReference(input: string | null | undefined): { perAmount: number; perUnit: string } | null {
  if (!input) return null;
  const n = normalizeText(input);
  if (/^(un|une|1)\s/.test(n) || /^(un|une)$/.test(n)) {
    if (/ml|millilitre/.test(n)) return { perAmount: 1, perUnit: 'ml' };
    return { perAmount: 1, perUnit: 'unit' };
  }
  const dose = parseDose(input);
  if (dose && (dose.unit === 'ml' || dose.unit === 'g' || dose.unit === 'mg')) {
    return { perAmount: dose.amount, perUnit: dose.unit };
  }
  return null;
}

/** Converts "12,50" or "1 234,56" to a number. */
export function parseEuroNumber(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/\s/g, '');
  if (!cleaned) return null;
  // BDPM uses "1,234,56"-style thousands separators in some rows: keep the last comma as decimal.
  const lastComma = cleaned.lastIndexOf(',');
  const normalised =
    lastComma >= 0 ? cleaned.slice(0, lastComma).replace(/[,.]/g, '') + '.' + cleaned.slice(lastComma + 1) : cleaned;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

/** Extracts a pack quantity from a presentation label ("plaquette(s) ... de 20 comprimé(s)"). */
export function parsePackQuantity(label: string): { quantity: number; unit: string } | null {
  const n = normalizeText(label);
  const m =
    n.match(/(\d+(?:[.,]\d+)?)\s*(comprimes?|gelules?|capsules?|sachets?|ampoules?|suppositoires?|doses?|patchs?)/) ??
    n.match(/(\d+(?:[.,]\d+)?)\s*(comprimidos?|capsulas?|sobres?|ampollas?|supositorios?|parches?)/);
  if (m) {
    const unit = /gelule|capsul/.test(m[2]!) ? 'capsule' : /sachet|sobre/.test(m[2]!) ? 'sachet' : /suppos/.test(m[2]!) ? 'suppository' : /patch|parche/.test(m[2]!) ? 'patch' : /ampo/.test(m[2]!) ? 'ampoule' : 'tablet';
    return { quantity: Number(m[1]!.replace(',', '.')), unit };
  }
  const v = n.match(/(\d+(?:[.,]\d+)?)\s*(ml|g)\b/);
  if (v) return { quantity: Number(v[1]!.replace(',', '.')), unit: v[2]! };
  return null;
}
