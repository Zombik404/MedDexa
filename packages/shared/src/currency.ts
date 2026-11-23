/**
 * Currency helpers. Exchange rates are expressed against EUR (the ECB reference
 * base): rates[X] = how many X one euro buys. Converted prices are estimates and are
 * always labelled as such in the UI.
 */

export const SUPPORTED_CURRENCIES = [
  'EUR',
  'HUF',
  'PLN',
  'CZK',
  'RON',
  'GBP',
  'CHF',
  'SEK',
  'DKK',
  'NOK',
  'BGN',
  'UAH',
  'USD',
] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface RateTable {
  base: 'EUR';
  /** ISO date the rates refer to. */
  date: string;
  source: string;
  rates: Record<string, number>;
}

export class MissingRateError extends Error {
  constructor(public readonly currency: string) {
    super(`No exchange rate available for ${currency}`);
  }
}

function rateOf(table: RateTable, currency: string): number {
  if (currency === 'EUR') return 1;
  const r = table.rates[currency];
  if (r == null || !(r > 0)) throw new MissingRateError(currency);
  return r;
}

/** Converts an amount between currencies through EUR. Not rounded. */
export function convert(amount: number, from: string, to: string, table: RateTable): number {
  if (from === to) return amount;
  return (amount / rateOf(table, from)) * rateOf(table, to);
}

/** Number of minor-unit digits commonly displayed for a currency. */
export function currencyDigits(currency: string): number {
  return currency === 'HUF' ? 0 : 2;
}

export function roundMoney(amount: number, currency: string): number {
  const f = 10 ** currencyDigits(currency);
  return Math.round(amount * f) / f;
}

export interface UnitPrice {
  value: number;
  per: string;
}

/** Price per countable unit or per ml/g of package content, when meaningful. */
export function pricePerUnit(
  price: number,
  packageSize: { quantity: number; unit: string } | null | undefined,
): UnitPrice | null {
  if (!packageSize || !(packageSize.quantity > 0) || !(price >= 0)) return null;
  return { value: price / packageSize.quantity, per: packageSize.unit };
}
