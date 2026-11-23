import { normaliseQuantity, normalizeText, type MedicineSummary } from '@meddexa/shared';

/**
 * Words printed on almost every box (dosage forms, units, packaging and legal text in the
 * languages MedDexa supports). They carry no information about *which* product it is.
 */
const BOX_STOPWORDS = new Set(
  `mg mcg ml g ug iu ie ne kg db pcs pc stk szt st x tab tabs caps
  tablet tablets tabletta tablettak filmtabletta filmtablettak tablette tabletten filmtabletten comprime comprimes comprimido comprimidos compresse compressa tabletki tabletka tabletek
  capsule capsules kapszula kapszulak kapsel kapseln gelule gelules capsula capsulas kapsulki
  film coated filmom bevont pelliculaire pelliculaires recubiertos recubierto rivestite powlekane
  oral orale buvable belsoleges zum einnehmen solution suspension sirup syrup szirup jarabe sirop
  gel krem cream creme crema salbe kenocs pomada pommade
  for use the and with without und mit ohne pour avec sans para con sin per und es vagy
  adult adults children child kids felnott gyermek kinder enfants ninos bambini dzieci
  pack package box contents contains contient contiene enthalt tartalmaz
  medicine medicinal product gyogyszer arzneimittel medicament medicamento farmaco lek
  prescription recept veny venykoteles verschreibungspflichtig ordonnance receta ricetta
  read leaflet before betegtajekoztato packungsbeilage notice prospecto foglietto ulotka
  keep out reach sight store below temperature batch lot exp expiry lejarat verwendbar
  each per contains active substance hatoanyag wirkstoff substance principio attivo
  pain relief fever fajdalom laz schmerz fieber douleur fievre dolor fiebre
  www com eu hu de fr es it pl nl pt ro`
    .split(/\s+/)
    .filter(Boolean),
);

export interface BoxText {
  /** Distinctive words in reading order (deduplicated). */
  words: string[];
  /** Strengths printed on the box, e.g. 400 mg. */
  doses: { amount: number; unit: string }[];
}

export function extractBoxText(lines: string[]): BoxText {
  const text = lines.join('\n');
  const doses: BoxText['doses'] = [];
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(mg|g|µg|μg|mcg|ml|iu|ie|%)(?![a-z])/gi)) {
    const amount = Number(m[1]!.replace(',', '.'));
    let unit = m[2]!.toLowerCase();
    if (unit === 'μg' || unit === 'mcg') unit = 'µg';
    if (unit === 'ie') unit = 'iu';
    if (Number.isFinite(amount) && amount > 0 && !doses.some((d) => d.amount === amount && d.unit === unit)) doses.push({ amount, unit });
  }
  const words: string[] = [];
  for (const line of lines) {
    for (const w of normalizeText(line).split(/[^a-z0-9]+/)) {
      if (w.length < 3 || !/[a-z]{3}/.test(w) || BOX_STOPWORDS.has(w) || words.includes(w)) continue;
      words.push(w);
    }
  }
  return { words: words.slice(0, 16), doses: doses.slice(0, 6) };
}

const wordMatch = (word: string, token: string) =>
  word === token || (word.length >= 5 && token.startsWith(word)) || (token.length >= 5 && word.startsWith(token));

function sameDose(a: { amount: number; unit: string }, b: { amount: number | null; unit: string | null }) {
  if (b.amount == null || !b.unit) return false;
  const na = normaliseQuantity(a.amount, a.unit === 'iu' ? 'IU' : a.unit);
  const nb = normaliseQuantity(b.amount, b.unit);
  if (na && nb && na.dimension === nb.dimension) return Math.abs(na.value - nb.value) < 1e-9;
  return a.amount === b.amount && a.unit === b.unit.toLowerCase();
}

/**
 * Scores catalogue candidates against what was read on a box. The product name (brand) weighs
 * most, then active ingredients, then printed strengths. Products scoring below the threshold
 * are dropped so a photo never "finds" an unrelated medicine.
 */
export function rankByBoxText(box: BoxText, candidates: MedicineSummary[], minScore = 4): { medicine: MedicineSummary; score: number }[] {
  return candidates
    .map((m) => {
      const nameTokens = normalizeText(m.name).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !BOX_STOPWORDS.has(t));
      const brandToken = nameTokens[0];
      let score = 0;
      const used = new Set<string>();
      for (const w of box.words) {
        if (brandToken && wordMatch(w, brandToken) && !used.has(brandToken)) {
          score += 4;
          used.add(brandToken);
        } else {
          const t = nameTokens.find((tok) => tok !== brandToken && !used.has(tok) && wordMatch(w, tok));
          if (t) {
            score += 2;
            used.add(t);
          }
        }
      }
      for (const ing of m.ingredients) {
        const ingTokens = normalizeText(ing.substanceName).split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
        const named = ingTokens.some((t) => box.words.some((w) => wordMatch(w, t)));
        const dosed = box.doses.some((d) => sameDose(d, ing));
        if (named) score += 1.5;
        if (dosed) score += 2;
        // An ingredient the box shows no trace of (e.g. the caffeine of a "Plus" variant).
        if (!named && !dosed && m.ingredients.length > 1) score -= 1.5;
      }
      // Distinctive name words that are not on the box ("Plus", "Forte", "Junior" …).
      score -= 0.5 * nameTokens.filter((t) => t !== brandToken && /[a-z]/.test(t) && !used.has(t)).length;
      return { medicine: m, score };
    })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
