export interface HoursLike {
  day: number;
  opens: string;
  closes: string;
}

const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Local weekday (0 = Monday) and "HH:MM" in an IANA time zone. */
export function localDayTime(tz: string, now = new Date()): { day: number; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { day: WEEKDAY[get('weekday')] ?? 0, time: `${get('hour')}:${get('minute')}` };
}

/**
 * Whether a pharmacy is open now. Returns null when hours are unknown, because
 * "closed" and "unknown" must never be confused. Supports spans past midnight.
 */
export function isOpenNow(hours: HoursLike[], tz: string, now = new Date()): boolean | null {
  if (!hours.length) return null;
  const { day, time } = localDayTime(tz, now);
  const prev = (day + 6) % 7;
  return hours.some((h) => {
    const overnight = h.closes < h.opens;
    if (h.day === day) return time >= h.opens && (overnight || time < h.closes);
    if (h.day === prev && overnight) return time < h.closes;
    return false;
  });
}
