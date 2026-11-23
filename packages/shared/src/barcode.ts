/**
 * Medicine pack codes as they appear on European boxes.
 *
 * - Linear EAN-13 / EAN-8 / UPC-A (GTIN) — most markets (HU 599…, ES 847000+CN, FR 3400+CIP)
 * - GS1 DataMatrix required by the Falsified Medicines Directive: AI (01) GTIN, (17) expiry,
 *   (10) batch, (21) serial and optionally a national number (NHRN, AIs 710–714)
 * - German PZN in Code 39 ("-12345678") and its NTIN (4150 + PZN + check digit)
 *
 * Parsing never decides which medicine a code is; it only produces candidate identifiers that
 * the catalogue is queried with.
 */

export type CodeSystem = 'GTIN' | 'CN_ES' | 'CIP13' | 'CIP7' | 'PZN' | 'TTT_HU' | 'AIM_PT' | 'OTHER';

export interface CodeCandidate {
  system: CodeSystem;
  code: string;
  countryCode: string | null;
}

export interface ParsedScan {
  raw: string;
  /** Canonical 14-digit GTIN when the scan contained a valid one. */
  gtin: string | null;
  candidates: CodeCandidate[];
  expiry: string | null;
  batch: string | null;
  serial: string | null;
}

const GS = '\u001d';

/** GS1 mod-10 check digit for the digits *before* the check digit. */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48;
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/** Left-pads a valid GTIN-8/12/13/14 to 14 digits; null when invalid. */
export function toGtin14(code: string): string | null {
  return isValidGtin(code) ? code.padStart(14, '0') : null;
}

/** EAN-13 for a Spanish national code (CN, 6 digits): 847000 + CN + check digit. */
export function gtinFromSpanishCn(cn: string): string | null {
  const six = cn.replace(/\D/g, '').slice(0, 6);
  if (six.length !== 6) return null;
  const body = `847000${six}`;
  return `${body}${gs1CheckDigit(body)}`;
}

/** PZN check digit (modulo 11). PZN8 weights 1..7; legacy PZN7 weights 2..7. */
export function isValidPzn(pzn: string): boolean {
  if (!/^\d{7,8}$/.test(pzn)) return false;
  const digits = pzn.split('').map(Number);
  const check = digits.pop()!;
  const offset = pzn.length === 8 ? 1 : 2;
  const sum = digits.reduce((s, d, i) => s + d * (i + offset), 0) % 11;
  return sum !== 10 && sum === check;
}

/** Candidates implied by a GTIN (national codes are embedded in some markets' GTINs). */
export function candidatesFromGtin(gtin14: string): CodeCandidate[] {
  const out: CodeCandidate[] = [{ system: 'GTIN', code: gtin14, countryCode: null }];
  const ean13 = gtin14.startsWith('0') ? gtin14.slice(1) : null;
  if (!ean13) return out;
  if (ean13.startsWith('847000')) out.push({ system: 'CN_ES', code: ean13.slice(6, 12), countryCode: 'ES' });
  else if (ean13.startsWith('3400')) out.push({ system: 'CIP13', code: ean13, countryCode: 'FR' });
  else if (ean13.startsWith('4150')) out.push({ system: 'PZN', code: ean13.slice(4, 12), countryCode: 'DE' });
  if (ean13.startsWith('599')) out[0] = { ...out[0]!, countryCode: 'HU' };
  return out;
}

// Fixed-length GS1 application identifiers we may meet on a medicine pack.
const FIXED: Record<string, number> = { '00': 18, '01': 14, '02': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2 };
// Variable-length AIs (max length), terminated by GS or end of data.
const VARIABLE: Record<string, number> = { '10': 20, '21': 20, '22': 20, '240': 30, '710': 20, '711': 20, '712': 20, '713': 20, '714': 20 };

function parseElementString(data: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    if (data[i] === GS) {
      i++;
      continue;
    }
    const two = data.slice(i, i + 2);
    const three = data.slice(i, i + 3);
    if (FIXED[two] !== undefined) {
      const len = FIXED[two]!;
      const value = data.slice(i + 2, i + 2 + len);
      if (value.length !== len) return null;
      out[two] = value;
      i += 2 + len;
    } else if (VARIABLE[three] !== undefined || VARIABLE[two] !== undefined) {
      const ai = VARIABLE[three] !== undefined ? three : two;
      const start = i + ai.length;
      let end = data.indexOf(GS, start);
      if (end === -1) end = data.length;
      out[ai] = data.slice(start, Math.min(end, start + VARIABLE[ai]!));
      i = end;
    } else {
      // Unknown AI: keep what we have (the GTIN usually comes first).
      break;
    }
  }
  return Object.keys(out).length ? out : null;
}

function nhrnCandidates(ai: Record<string, string>): CodeCandidate[] {
  const out: CodeCandidate[] = [];
  if (ai['710']) out.push({ system: 'PZN', code: ai['710'].replace(/^PZN-?/i, ''), countryCode: 'DE' });
  if (ai['711']) out.push({ system: 'CIP13', code: ai['711'], countryCode: 'FR' });
  if (ai['712']) out.push({ system: 'CN_ES', code: ai['712'].slice(0, 6), countryCode: 'ES' });
  if (ai['714']) out.push({ system: 'AIM_PT', code: ai['714'], countryCode: 'PT' });
  return out;
}

const unique = (list: CodeCandidate[]) => {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = `${c.system}:${c.code}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * Parses whatever a scanner (or a person typing) produced. Returns an empty candidate list
 * when nothing plausible was found.
 */
export function parseScannedCode(input: string): ParsedScan {
  const raw = input.trim();
  const result: ParsedScan = { raw, gtin: null, candidates: [], expiry: null, batch: null, serial: null };
  if (!raw) return result;

  // GS1: symbology identifier (]d2, ]C1, ]Q3), human-readable "(01)…" or a bare element string.
  let data = raw.replace(/^\][A-Za-z]\d/, '');
  if (data.startsWith('(')) data = data.replace(/\((\d{2,4})\)/g, (_m, ai: string) => `${GS}${ai}`).replace(/^\u001d/, '');
  if (/^01\d{14}/.test(data) || data.includes(GS)) {
    const ai = parseElementString(data);
    if (ai?.['01']) {
      const gtin = toGtin14(ai['01']);
      if (gtin) {
        result.gtin = gtin;
        result.candidates.push(...candidatesFromGtin(gtin));
      }
      result.expiry = ai['17'] ?? null;
      result.batch = ai['10'] ?? null;
      result.serial = ai['21'] ?? null;
      result.candidates.push(...nhrnCandidates(ai));
      result.candidates = unique(result.candidates);
      return result;
    }
  }

  // Code 39 PZN: "-12345678", "PZN-12345678", "PZN 1234567".
  const pzn = raw.match(/^(?:PZN)?\s*-?\s*(\d{7,8})$/i);
  if (pzn && /[-A-Za-z]/.test(raw) && isValidPzn(pzn[1]!)) {
    result.candidates.push({ system: 'PZN', code: pzn[1]!.padStart(8, '0'), countryCode: 'DE' });
    return result;
  }

  const digits = raw.replace(/[\s.-]/g, '');
  if (!/^\d+$/.test(digits)) return result;

  const gtin = toGtin14(digits);
  if (gtin) {
    result.gtin = gtin;
    result.candidates.push(...candidatesFromGtin(gtin));
  }
  if (digits.length === 8 && isValidPzn(digits)) result.candidates.push({ system: 'PZN', code: digits, countryCode: 'DE' });
  // Typed national codes: Spanish CN (6 digits, or 7 with its check digit), French CIP7.
  if (digits.length === 6) result.candidates.push({ system: 'CN_ES', code: digits, countryCode: 'ES' });
  if (digits.length === 7) {
    result.candidates.push({ system: 'CN_ES', code: digits.slice(0, 6), countryCode: 'ES' });
    result.candidates.push({ system: 'CIP7', code: digits, countryCode: 'FR' });
    if (isValidPzn(digits)) result.candidates.push({ system: 'PZN', code: digits.padStart(8, '0'), countryCode: 'DE' });
  }
  if (digits.length === 9 && digits.startsWith('2')) result.candidates.push({ system: 'TTT_HU', code: digits, countryCode: 'HU' });
  result.candidates = unique(result.candidates);
  return result;
}
