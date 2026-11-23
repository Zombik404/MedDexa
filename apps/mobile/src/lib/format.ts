import i18n from '@/i18n';

const locale = () => i18n.language || 'en';

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(locale(), {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'HUF' ? 0 : 2,
      minimumFractionDigits: currency === 'HUF' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(n: number, digits = 2): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(n);
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale(), opts).format(new Date(iso));
}

export function formatDistance(km: number | null | undefined): string | null {
  if (km == null) return null;
  return km < 1 ? i18n.t('common.m', { value: Math.round(km * 1000) }) : i18n.t('common.km', { value: formatNumber(km, 1) });
}

export function countryName(code: string | null | undefined): string {
  if (!code) return '—';
  try {
    return new Intl.DisplayNames([locale()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Unicode regional-indicator flag for a country code. */
export function flag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🇪🇺';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function unitLabel(unit: string, count = 2): string {
  const n = count === 1 ? 'one' : 'other';
  const map: Record<string, Record<string, string>> = {
    tablet: { one: 'tablet', other: 'tablets' },
    capsule: { one: 'capsule', other: 'capsules' },
  };
  return map[unit]?.[n] ?? unit;
}
