/**
 * Normalises free text for search and duplicate detection: removes diacritics,
 * lowercases, unifies the micro sign and collapses punctuation/whitespace.
 * "Ibuprofén  400 mg" → "ibuprofen 400 mg"
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[μµ]/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%.,/+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a normalised query into search tokens. */
export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[\s/,+-]+/)
    .map((t) => t.replace(/^[.,]+|[.,]+$/g, ''))
    .filter((t) => t.length > 0);
}

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'e', є: 'e', ж: 'zh', з: 'z', и: 'i', і: 'i', ї: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch',
  ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

/**
 * Russian/Ukrainian spelling of an international name → Latin, tuned for INNs
 * ("ибупрофен" → "ibuprofen", "парацетамол" → "paracetamol", "амоксициллин" → "amoxicillin").
 * The catalogue uses Latin-script names, so Cyrillic queries are searched through this.
 */
export function transliterateCyrillic(input: string): string {
  return input
    .toLowerCase()
    .replace(/кс/g, 'x')
    .split('')
    .map((ch) => CYR[ch] ?? ch)
    .join('');
}
