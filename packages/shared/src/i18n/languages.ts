export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hu', name: 'Magyar' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pl', name: 'Polski' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pt', name: 'Português' },
  { code: 'ro', name: 'Română' },
  { code: 'uk', name: 'Українська' },
  { code: 'ru', name: 'Русский' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** Markets MedDexa is designed for; `supported` flips on as integrations go live. */
export const MARKETS = [
  { code: 'HU', currency: 'HUF' },
  { code: 'DE', currency: 'EUR' },
  { code: 'AT', currency: 'EUR' },
  { code: 'PL', currency: 'PLN' },
  { code: 'FR', currency: 'EUR' },
  { code: 'ES', currency: 'EUR' },
  { code: 'IT', currency: 'EUR' },
  { code: 'NL', currency: 'EUR' },
  { code: 'BE', currency: 'EUR' },
  { code: 'PT', currency: 'EUR' },
  { code: 'RO', currency: 'RON' },
  { code: 'CZ', currency: 'CZK' },
  { code: 'SK', currency: 'EUR' },
] as const;
