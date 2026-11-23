import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '@meddexa/shared';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hu from './locales/hu.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';

export const resources = { en, hu, de, fr, es, it, pl, nl, pt, ro, uk, ru } as const;
const supported = SUPPORTED_LANGUAGES.map((l) => l.code) as string[];

export function deviceLanguage(): string {
  for (const l of getLocales()) {
    if (l.languageCode && supported.includes(l.languageCode)) return l.languageCode;
  }
  return DEFAULT_LANGUAGE;
}

export function resolveLanguage(preference: string | null): string {
  return preference && supported.includes(preference) ? preference : deviceLanguage();
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, { translation: v }])),
  lng: deviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
