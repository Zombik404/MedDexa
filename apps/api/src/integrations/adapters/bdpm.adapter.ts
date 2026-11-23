import type { DataAdapter, SyncContext, SyncResult } from '../adapter';
import { upsertImportedMedicine, type ImportedMedicine } from '../importer';
import { mapFormCode, mapRoute, parseDose, parseEuroNumber, parsePackQuantity, parseReference, releaseFromForm } from '../normalise';

/**
 * Base de données publique des médicaments (France). Tab-separated files without header
 * (format documented by ANSM, "Contenu et format des fichiers téléchargeables dans la BDM v3").
 */
export const BDPM_FILES = {
  specialities: 'CIS_bdpm.txt',
  presentations: 'CIS_CIP_bdpm.txt',
  compositions: 'CIS_COMPO_bdpm.txt',
  prescription: 'CIS_CPD_bdpm.txt',
} as const;

const rows = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split('\t').map((c) => c.trim()));

export function parseFrDate(d: string | undefined): Date | null {
  const m = d?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

export function buildBdpmMedicines(files: {
  specialities: string;
  presentations: string;
  compositions: string;
  prescription?: string;
}, observedAt: Date): ImportedMedicine[] {
  const compo = new Map<string, string[][]>();
  for (const r of rows(files.compositions)) {
    const list = compo.get(r[0]!) ?? [];
    list.push(r);
    compo.set(r[0]!, list);
  }
  const presentations = new Map<string, string[][]>();
  for (const r of rows(files.presentations)) {
    const list = presentations.get(r[0]!) ?? [];
    list.push(r);
    presentations.set(r[0]!, list);
  }
  const listI = new Set<string>();
  for (const r of rows(files.prescription ?? '')) {
    if (/liste i|liste ii|stupéfiant|prescription/i.test(r[1] ?? '')) listI.add(r[0]!);
  }

  const out: ImportedMedicine[] = [];
  for (const s of rows(files.specialities)) {
    const [cis, name, formName, routes, ammStatus, , commercial, ammDate, , , holder] = s;
    if (!cis || !name) continue;
    if (commercial && !/^commercialis/i.test(commercial)) continue;
    const formCode = mapFormCode(formName);

    // Ingredients: a therapeutic fraction (FT) is the active moiety of the linked active
    // substance (SA) with the same link number; the quantity follows the FT when given.
    const components = compo.get(cis) ?? [];
    const byLink = new Map<string, { sa?: string[]; ft?: string[] }>();
    for (const c of components) {
      const key = c[7] || `${c[2]}`;
      const entry = byLink.get(key) ?? {};
      if (c[6] === 'FT') entry.ft = c;
      else entry.sa = c;
      byLink.set(key, entry);
    }
    const ingredients = [...byLink.values()].flatMap(({ sa, ft }) => {
      const main = sa ?? ft;
      if (!main) return [];
      const quantitySource = ft ?? sa!;
      const dose = parseDose(quantitySource[4]);
      const ref = parseReference(quantitySource[5]);
      return [
        {
          name: main[3]!,
          moietyName: ft ? ft[3]! : null,
          amount: dose?.amount ?? null,
          unit: dose?.unit ?? null,
          perAmount: ref?.perAmount ?? null,
          perUnit: ref?.perUnit ?? null,
          basis: ft ? ('MOIETY' as const) : ('SUBSTANCE' as const),
        },
      ];
    });

    out.push({
      sourceReference: cis,
      name,
      brand: name.split(/\s\d/)[0]?.split(',')[0]?.trim() ?? null,
      manufacturerName: holder?.split(';')[0]?.trim() || null,
      countryCode: 'FR',
      authority: 'ANSM',
      registrationNumber: cis,
      registrationStatus: /active/i.test(ammStatus ?? '') ? 'AUTHORISED' : /suspendue/i.test(ammStatus ?? '') ? 'SUSPENDED' : /abrog|retir/i.test(ammStatus ?? '') ? 'WITHDRAWN' : 'UNKNOWN',
      authorisedAt: parseFrDate(ammDate),
      atcCode: null,
      formCode,
      route: mapRoute(routes?.split(';')[0]),
      release: releaseFromForm(formCode, formName),
      prescription: listI.has(cis) ? 'RX' : 'UNKNOWN',
      ingredients,
      packages: (presentations.get(cis) ?? []).map((p) => {
        const pack = parsePackQuantity(p[2] ?? '');
        const price = parseEuroNumber(p[9]);
        return {
          description: p[2] ?? '',
          quantity: pack?.quantity ?? null,
          unit: pack?.unit ?? null,
          barcode: p[6] || null,
          registrationNumber: p[1] || null,
          // Column 10 is the regulated price of reimbursed presentations.
          price: price != null ? { amount: price, currency: 'EUR', priceType: 'REIMBURSEMENT_REFERENCE' as const, observedAt } : null,
        };
      }),
    });
  }
  return out;
}

async function readText(ctx: SyncContext, file: string): Promise<string> {
  const dir = ctx.config.directory as string | undefined;
  if (dir) {
    const { readFile } = await import('node:fs/promises');
    const buf = await readFile(`${dir.replace(/\/$/, '')}/${file}`);
    return decode(buf);
  }
  const base = (ctx.config.baseUrl as string | undefined) ?? 'https://base-donnees-publique.medicaments.gouv.fr/download/file/';
  const res = await ctx.fetch(`${base}${file}`);
  if (!res.ok) throw new Error(`BDPM ${file} responded ${res.status}`);
  return decode(Buffer.from(await res.arrayBuffer()));
}

/** Files have historically been Windows-1252; newer exports are UTF-8. */
function decode(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

/** Config: { directory?: string, baseUrl?: string, limit?: number } */
export const bdpmAdapter: DataAdapter = {
  key: 'bdpm',
  async sync(ctx: SyncContext): Promise<SyncResult> {
    const files = {
      specialities: await readText(ctx, BDPM_FILES.specialities),
      presentations: await readText(ctx, BDPM_FILES.presentations),
      compositions: await readText(ctx, BDPM_FILES.compositions),
      prescription: await readText(ctx, BDPM_FILES.prescription).catch(() => ''),
    };
    const meds = buildBdpmMedicines(files, new Date());
    const limit = Number(ctx.config.limit ?? meds.length);
    const result: SyncResult = { read: 0, created: 0, updated: 0, failed: 0 };
    for (const m of meds.slice(0, limit)) {
      result.read++;
      try {
        (await upsertImportedMedicine(ctx.prisma, ctx.source.id, m)) === 'created' ? result.created++ : result.updated++;
      } catch (e) {
        result.failed++;
        ctx.log(`BDPM ${m.sourceReference} failed: ${(e as Error).message}`);
      }
    }
    return result;
  },
};
