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
