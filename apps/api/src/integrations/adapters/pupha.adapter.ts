import { unzipSync } from 'fflate';
import { normalizeText } from '@meddexa/shared';
import type { DataAdapter, SyncContext, SyncResult } from '../adapter';
import { upsertImportedMedicine, type ImportedMedicine } from '../importer';
import { mapFormCode, mapRoute, releaseFromForm } from '../normalise';

/**
 * NEAK Publikus Gyógyszertörzs (PUPHA) — Hungary's public medicine master file, published
 * monthly as a zipped Microsoft Access database. Column names follow
 * "PUPHA táblaszerkezet v3.5" (NEAK ÁTFO, 2026-01-15), table GYOGYSZ.
 */
export interface PuphaRow {
  OEP_TTT?: string | null; // NEAK product code (one per pack)
  OEP_TK?: string | null; // OGYÉI marketing authorisation number, e.g. "OGYI-T-1234/01"
  OEP_EAN?: string | null; // EAN-13 printed on the box
  OEP_ATC?: string | null;
  OEP_NEV?: string | null; // product name
  KISZ_MENNY?: number | null; // pack quantity
  KISZ_EGYS?: string | null; // pack unit
  GYFORMA?: string | null; // dosage form (Hungarian text)
  HATOANYAG?: string | null; // main active ingredient(s)
  HATO_MENNY?: number | null;
  HATO_EGYS?: string | null;
  OHATO_MENNY?: number | null; // total active content of the pack
  FORGENGT?: string | null; // marketing authorisation holder
  OEP_FAB?: number | null; // gross consumer price (HUF)
  RENDELHET?: string | null; // VN = without prescription, V/J/SZ/I… = prescription
  FORGALOMBAN?: number | null; // 1 on the market, 0 supply problem
  OEP_DAT?: string | null; // validity start, yyyymmdd
  VEGE?: Date | string | null; // validity end (2099-12-31 when open)
}

const HU_PACK_UNITS: Record<string, string> = {
  db: 'tablet',
  x: 'tablet',
  tabletta: 'tablet',
  filmtabletta: 'tablet',
  kapszula: 'capsule',
  ml: 'ml',
  g: 'g',
  tasak: 'sachet',
  adag: 'dose',
  tapasz: 'patch',
  ampulla: 'ampoule',
  kupak: 'unit',
};

/** Pack unit: tablets/capsules follow the dosage form when PUPHA counts "db" (pieces). */
function packUnit(raw: string | null | undefined, form: string | null | undefined): string | null {
  const u = normalizeText(raw ?? '').replace(/\./g, '');
  const f = normalizeText(form ?? '');
  if ((u === 'db' || u === 'x' || u === '') && f.includes('kapszula')) return 'capsule';
  return HU_PACK_UNITS[u] ?? (u || null);
}

export function mapRendelhet(code: string | null | undefined): 'OTC' | 'RX' | 'UNKNOWN' {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return 'UNKNOWN';
  if (c.startsWith('VN')) return 'OTC';
  return /^(V|J|SZ|I|SZK)\b/.test(c) ? 'RX' : 'UNKNOWN';
}

function parseYmd(v: string | null | undefined): Date | null {
  if (!v || !/^\d{8}$/.test(v)) return null;
  return new Date(Date.UTC(Number(v.slice(0, 4)), Number(v.slice(4, 6)) - 1, Number(v.slice(6, 8))));
}

/** Product identity: the authorisation number without its pack suffix plus the name. */
export function puphaProductKey(r: PuphaRow): string {
  const tk = (r.OEP_TK ?? '').split('/')[0]!.trim().toUpperCase();
  return `${tk}|${normalizeText(r.OEP_NEV ?? '')}`;
}

/**
 * Strength per dosage unit is taken from HATO_MENNY/HATO_EGYS only when the record is
 * self-consistent (one ingredient and total content = strength × pack size). Otherwise the
 * strength stays unknown instead of being guessed.
 */
export function puphaStrength(r: PuphaRow): { amount: number | null; unit: string | null } {
  const names = splitIngredients(r.HATOANYAG);
  const amount = r.HATO_MENNY ?? null;
  const unit = (r.HATO_EGYS ?? '').trim().toLowerCase() || null;
  if (names.length !== 1 || amount == null || !unit || !r.KISZ_MENNY || r.OHATO_MENNY == null) return { amount: null, unit: null };
  const expected = amount * r.KISZ_MENNY;
  return Math.abs(expected - r.OHATO_MENNY) <= expected * 0.01 ? { amount, unit } : { amount: null, unit: null };
}

function splitIngredients(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[,+;]| és /)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Groups PUPHA pack rows into products. Rows whose validity has ended are skipped. */
export function buildPuphaMedicines(rows: PuphaRow[], now = new Date()): ImportedMedicine[] {
  const groups = new Map<string, PuphaRow[]>();
  for (const r of rows) {
    if (!r.OEP_NEV || !r.OEP_TK) continue;
    const end = r.VEGE ? new Date(r.VEGE) : null;
    if (end && !Number.isNaN(end.getTime()) && end < now) continue;
    const key = puphaProductKey(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: ImportedMedicine[] = [];
  for (const [key, packs] of groups) {
    const first = packs[0]!;
    const formCode = mapFormCode(first.GYFORMA ?? undefined);
    const strength = puphaStrength(first);
    const names = splitIngredients(first.HATOANYAG);
    out.push({
      sourceReference: key,
      name: first.OEP_NEV!.trim(),
      brand: first.OEP_NEV!.trim().split(/\s\d/)[0]?.trim() ?? null,
      manufacturerName: first.FORGENGT?.trim() || null,
      countryCode: 'HU',
      authority: 'OGYÉI',
      registrationNumber: first.OEP_TK!.split('/')[0]!.trim(),
      registrationStatus: 'AUTHORISED',
      atcCode: first.OEP_ATC && first.OEP_ATC.trim().length === 7 ? first.OEP_ATC.trim().toUpperCase() : null,
      formCode,
      route: mapRoute(first.GYFORMA ?? undefined) ?? (formCode && /TABLET|CAPSULE|SYRUP|ORAL|GRANULES/.test(formCode) ? 'ORAL' : null),
      release: releaseFromForm(formCode, first.GYFORMA ?? undefined),
      prescription: mapRendelhet(first.RENDELHET),
      ingredients: names.map((name) => (names.length === 1 ? { name, ...strength } : { name, amount: null, unit: null })),
      packages: packs.map((p) => {
        const observedAt = parseYmd(p.OEP_DAT) ?? new Date();
        return {
          description: `${p.OEP_NEV!.trim()} · ${p.KISZ_MENNY ?? '?'} ${p.KISZ_EGYS ?? ''}`.trim(),
          quantity: p.KISZ_MENNY ?? null,
          unit: packUnit(p.KISZ_EGYS, p.GYFORMA),
          barcode: p.OEP_EAN?.trim() || null,
          registrationNumber: p.OEP_TK?.trim() || null,
          codes: p.OEP_TTT ? [{ system: 'TTT_HU' as const, code: p.OEP_TTT.trim(), countryCode: 'HU' }] : [],
          // Published gross consumer price; for reimbursed products it is the regulated price.
          price: p.OEP_FAB && p.OEP_FAB > 0 ? { amount: p.OEP_FAB, currency: 'HUF', priceType: 'REIMBURSEMENT_REFERENCE' as const, observedAt } : null,
        };
      }),
    });
  }
  return out;
}

interface MdbTable {
  getData(): Record<string, unknown>[];
}
interface MdbReaderLike {
  getTable(name: string): MdbTable;
}

/** Reads table GYOGYSZ from the zipped Access file. */
export function readPuphaZip(zip: Uint8Array): PuphaRow[] {
  const files = unzipSync(zip);
  const name = Object.keys(files).find((f) => /\.(mdb|accdb)$/i.test(f));
  if (!name) throw new Error('PUPHA archive contains no Access database');
  // mdb-reader is an ES module; Node ≥ 22 can require it synchronously.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MDBReader = (require('mdb-reader') as { default: new (b: Buffer) => MdbReaderLike }).default;
  const reader = new MDBReader(Buffer.from(files[name]!));
  return reader.getTable('GYOGYSZ').getData() as PuphaRow[];
}

/** Default download URL for the release of a given month (published on the 1st). */
export function puphaUrlFor(date: Date): string {
  const ymd = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}01`;
  return `https://www.neak.gov.hu/pfile/file?path=/letoltheto/ATFO_dok/gyogyszer/PUPHA/PUPHA_${ymd}_v3.zip1&inline=true`;
}

/**
 * Config: { url?: string, file?: string (local path to the downloaded zip), limit?: number }.
 * Without either, the current month's release URL is used.
 */
export const puphaAdapter: DataAdapter = {
  key: 'pupha',
  async sync(ctx: SyncContext): Promise<SyncResult> {
    let zip: Uint8Array;
    const file = ctx.config.file as string | undefined;
    if (file) {
      const { readFile } = await import('node:fs/promises');
      zip = await readFile(file);
    } else {
      const url = (ctx.config.url as string | undefined) ?? ctx.source.url ?? puphaUrlFor(new Date());
      const res = await ctx.fetch(url);
      if (!res.ok) throw new Error(`PUPHA download responded ${res.status}`);
      zip = new Uint8Array(await res.arrayBuffer());
    }
    const medicines = buildPuphaMedicines(readPuphaZip(zip));
    const limit = Number(ctx.config.limit ?? 0) || medicines.length;
    const result: SyncResult = { read: 0, created: 0, updated: 0, failed: 0 };
    for (const m of medicines.slice(0, limit)) {
      result.read++;
      try {
        (await upsertImportedMedicine(ctx.prisma, ctx.source.id, m)) === 'created' ? result.created++ : result.updated++;
      } catch (e) {
        result.failed++;
        ctx.log(`PUPHA ${m.sourceReference} failed: ${(e as Error).message}`);
      }
    }
    return result;
  },
};
