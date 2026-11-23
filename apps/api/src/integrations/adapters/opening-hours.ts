/**
 * Parser for the common subset of the OpenStreetMap opening_hours syntax:
 *   "Mo-Fr 08:00-20:00; Sa 09:00-13:00", "Mo,We 08:00-12:00,14:00-18:00", "24/7".
 * Anything it does not understand returns null, so we show "hours unknown" rather than
 * a wrong schedule.
 */
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export interface HoursRow {
  day: number;
  opens: string;
  closes: string;
}

export function parseOsmOpeningHours(input: string | undefined | null): HoursRow[] | null {
  if (!input) return null;
  const value = input.trim();
  if (value === '24/7') return DAYS.map((_, day) => ({ day, opens: '00:00', closes: '24:00' }));
  const rows: HoursRow[] = [];
  for (const rule of value.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^([A-Za-z,\- ]+?)\s+((?:\d{2}:\d{2}-\d{2}:\d{2},?\s*)+|off|closed)$/);
    if (!m) return null;
    const days = expandDays(m[1]!.replace(/\s/g, ''));
    if (!days) return null;
    if (m[2] === 'off' || m[2] === 'closed') {
      for (const d of days) for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.day === d) rows.splice(i, 1);
      continue;
    }
    const spans = m[2]!.split(',').map((s) => s.trim()).filter(Boolean);
    for (const d of days) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.day === d) rows.splice(i, 1);
      for (const span of spans) {
        const [opens, closes] = span.split('-') as [string, string];
        if (!validTime(opens) || !validTime(closes)) return null;
        rows.push({ day: d, opens, closes });
      }
    }
  }
  return rows.sort((a, b) => a.day - b.day || a.opens.localeCompare(b.opens));
}

function validTime(t: string) {
  const m = t.match(/^(\d{2}):(\d{2})$/);
  return !!m && Number(m[1]) <= 24 && Number(m[2]) < 60;
}

function expandDays(spec: string): number[] | null {
  const out: number[] = [];
  for (const part of spec.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-');
      const s = DAYS.indexOf(a!);
      const e = DAYS.indexOf(b!);
      if (s < 0 || e < 0) return null;
      for (let i = s; ; i = (i + 1) % 7) {
        out.push(i);
        if (i === e) break;
      }
    } else {
      const i = DAYS.indexOf(part);
      if (i < 0) return null;
      out.push(i);
    }
  }
  return out;
}
