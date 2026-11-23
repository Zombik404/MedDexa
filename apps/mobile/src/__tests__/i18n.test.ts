import en from '../i18n/locales/en.json';
import { resources } from '../i18n';

type Tree = { [k: string]: string | string[] | Tree };
const PLURAL = /_(zero|one|two|few|many|other)$/;

function keys(tree: Tree, prefix = ''): Map<string, string | string[]> {
  const out = new Map<string, string | string[]>();
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && !Array.isArray(v)) for (const [kk, vv] of keys(v as Tree, path)) out.set(kk, vv);
    else out.set(path.replace(PLURAL, '_PLURAL'), v);
  }
  return out;
}
const placeholders = (s: string | string[]) => [...String(s).matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort().join(',');

describe('translations', () => {
  const base = keys(en as Tree);
  it('ships the 12 required languages', () => {
    expect(Object.keys(resources).sort()).toEqual(['de', 'en', 'es', 'fr', 'hu', 'it', 'nl', 'pl', 'pt', 'ro', 'ru', 'uk']);
  });

  for (const [lang, tree] of Object.entries(resources)) {
    it(`${lang} has every key of en with the same placeholders`, () => {
      const t = keys(tree as unknown as Tree);
      const missing = [...base.keys()].filter((k) => !t.has(k));
      const extra = [...t.keys()].filter((k) => !base.has(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
      for (const [k, v] of base) expect([k, placeholders(t.get(k)!)]).toEqual([k, placeholders(v)]);
      expect((t.get('days') as string[]).length).toBe(7);
    });
  }

  it('provides every plural category the language needs', () => {
    const needs: Record<string, string[]> = { pl: ['one', 'few', 'many', 'other'], ru: ['one', 'few', 'many', 'other'], uk: ['one', 'few', 'many', 'other'], ro: ['one', 'few', 'other'] };
    for (const [lang, cats] of Object.entries(needs)) {
      const results = (resources as unknown as Record<string, { search: Record<string, unknown> }>)[lang]!.search;
      for (const c of cats) expect(results[`results_${c}`]).toBeTruthy();
    }
  });
});
