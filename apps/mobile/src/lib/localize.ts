import type { IngredientView } from '@meddexa/shared';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIngredientNames } from '@/api/hooks';

/** Unit symbols as written in Cyrillic-script pharmacopoeias; Latin-script languages keep SI symbols. */
const UNIT_SYMBOLS: Record<string, Record<string, string>> = {
  ru: { mg: 'мг', µg: 'мкг', mcg: 'мкг', ml: 'мл', g: 'г', kg: 'кг', IU: 'МЕ', mmol: 'ммоль' },
  uk: { mg: 'мг', µg: 'мкг', mcg: 'мкг', ml: 'мл', g: 'г', kg: 'кг', IU: 'МО', mmol: 'ммоль' },
};

export function localizeDose(text: string | null | undefined, lang: string): string {
  if (!text) return text ?? '';
  const map = UNIT_SYMBOLS[lang.slice(0, 2)];
  if (!map) return text;
  return text.replace(/(^|[\d\s/])(mg|µg|mcg|ml|kg|g|IU|mmol)(?=$|[\s/,)])/g, (_m, pre: string, u: string) => `${pre}${map[u] ?? u}`);
}

/**
 * Everything the catalogue says in English (ingredient INNs, dosage forms, units, pack units)
 * shown in the user's language. Product names stay as registered — they are names.
 */
export function useLocalize() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const names = useIngredientNames();

  const ingredientName = useCallback(
    (name: string, id?: string | null) => (id && names.data?.byId[id]) || names.data?.byName[name] || name,
    [names.data],
  );
  const ingredient = useCallback(
    (i: Pick<IngredientView, 'substanceId' | 'substanceName'>) => ingredientName(i.substanceName, i.substanceId),
    [ingredientName],
  );
  const form = useCallback((f: { code: string; name: string } | null | undefined) => (f ? t(`form.${f.code}`, { defaultValue: f.name }) : ''), [t]);
  const dose = useCallback((text: string | null | undefined) => localizeDose(text, lang), [lang]);
  const pack = useCallback(
    (quantity: number | string, unit: string) => `${Number(quantity)} ${t(`packUnit.${unit}`, { defaultValue: localizeDose(unit, lang) })}`,
    [t, lang],
  );
  return { ingredient, ingredientName, form, dose, pack, lang };
}
