import type { DataAdapter, SyncContext, SyncResult } from '../adapter';
import { gtinFromSpanishCn } from '@meddexa/shared';
import { upsertImportedMedicine, type ImportedMedicine, type ImportedPackage } from '../importer';
import { mapFormCode, mapRoute, releaseFromForm } from '../normalise';

/** Subset of a CIMA `medicamento` response (verified against the live API, Nov 2026). */
export interface CimaMedicamento {
  nregistro: string;
  nombre: string;
  labtitular?: string;
  comerc?: boolean;
  receta?: boolean;
  estado?: { aut?: number; susp?: number; rev?: number };
  principiosActivos?: { id: number; codigo?: string; nombre: string; cantidad?: string; unidad?: string; orden?: number }[];
  atcs?: { codigo: string; nombre: string; nivel: number }[];
  viasAdministracion?: { id: number; nombre: string }[];
  formaFarmaceutica?: { id: number; nombre: string };
  presentaciones?: { cn: string; nombre: string; comerc?: boolean }[];
  docs?: { tipo: number; url: string }[];
  fotos?: { tipo: string; url: string }[];
}

/**
 * CIMA quantities can be "400", "1,16" or "100 mg/5 ml"-style units ("mg/5 ml").
 */
export function parseCimaStrength(cantidad?: string, unidad?: string) {
  const amount = cantidad ? Number(cantidad.replace(',', '.')) : NaN;
  if (!Number.isFinite(amount) || !unidad) return { amount: null, unit: null, perAmount: null, perUnit: null };
  const u = unidad.trim().toLowerCase();
  const per = u.match(/^([a-zµ%]+)\s*\/\s*(\d+(?:[.,]\d+)?)?\s*([a-z]+)$/);
  if (per) {
    return {
      amount,
      unit: per[1]!,
      perAmount: per[2] ? Number(per[2].replace(',', '.')) : 1,
      perUnit: per[3] === 'comprimido' || per[3] === 'capsula' ? 'unit' : per[3]!,
    };
  }
  return { amount, unit: u === 'microgramos' ? 'µg' : u, perAmount: null, perUnit: null };
}

const CIMA_PACK_UNITS: Record<string, string> = {
  comprimido: 'tablet',
  comprimidos: 'tablet',
  capsula: 'capsule',
  capsulas: 'capsule',
  sobre: 'sachet',
  sobres: 'sachet',
  parche: 'patch',
  parches: 'patch',
  ampolla: 'ampoule',
  ampollas: 'ampoule',
  vial: 'vial',
  viales: 'vial',
  supositorio: 'suppository',
  supositorios: 'suppository',
  ml: 'ml',
  g: 'g',
};

/** "ASPIRINA C … , 10 comprimidos" → { quantity: 10, unit: 'tablet' }. */
export function parseCimaPresentation(nombre: string): { quantity: number; unit: string } | null {
  const tail = (nombre.split(',').pop() ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  // "1 frasco de 200 ml" → the first count with a known unit (200 ml), not the container.
  for (const m of tail.matchAll(/(\d+(?:[.,]\d+)?)\s*([a-z]+)/g)) {
    const unit = CIMA_PACK_UNITS[m[2]!];
    if (unit) return { quantity: Number(m[1]!.replace(',', '.')), unit };
  }
  return null;
}

export function mapCimaPresentation(p: { cn: string; nombre: string }): ImportedPackage {
  const pack = parseCimaPresentation(p.nombre);
  return {
    description: p.nombre,
    quantity: pack?.quantity ?? null,
    unit: pack?.unit ?? null,
    // The EAN-13 on Spanish boxes embeds the national code (847000 + CN + check digit).
    barcode: gtinFromSpanishCn(p.cn),
    codes: [{ system: 'CN_ES', code: p.cn, countryCode: 'ES' }],
  };
}

export function mapCimaMedicamento(m: CimaMedicamento): ImportedMedicine {
  const formCode = mapFormCode(m.formaFarmaceutica?.nombre);
  const atc = m.atcs?.slice().sort((a, b) => b.nivel - a.nivel)[0];
  return {
    sourceReference: m.nregistro,
    name: m.nombre,
    brand: m.nombre.split(/\s\d/)[0]?.trim() ?? null,
    manufacturerName: m.labtitular ?? null,
    countryCode: 'ES',
    authority: 'AEMPS',
    registrationNumber: m.nregistro,
    registrationStatus: m.estado?.susp ? 'SUSPENDED' : m.estado?.rev ? 'WITHDRAWN' : m.estado?.aut ? 'AUTHORISED' : 'UNKNOWN',
    authorisedAt: m.estado?.aut ? new Date(m.estado.aut) : null,
    atcCode: atc && atc.nivel === 5 ? atc.codigo : null,
    atcName: atc && atc.nivel === 5 ? atc.nombre : null,
    formCode,
    route: mapRoute(m.viasAdministracion?.[0]?.nombre),
    release: releaseFromForm(formCode, m.formaFarmaceutica?.nombre),
    prescription: m.receta === true ? 'RX' : m.receta === false ? 'OTC' : 'UNKNOWN',
    ingredients: (m.principiosActivos ?? [])
      .slice()
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((p) => ({ name: p.nombre, ...parseCimaStrength(p.cantidad, p.unidad) })),
    // CIMA presentations carry the national code but no price.
    packages: (m.presentaciones ?? []).map(mapCimaPresentation),
    documents: (m.docs ?? [])
      .filter((d) => d.tipo === 1 || d.tipo === 2)
      .map((d) => ({
        kind: d.tipo === 1 ? ('SMPC' as const) : ('PIL' as const),
        title: d.tipo === 1 ? 'Ficha técnica' : 'Prospecto',
        language: 'es',
        url: d.url,
      })),
    // Packaging photo published by AEMPS ("materialas"); the pill photo ("formafarmac") is the fallback.
    imageUrl: m.fotos?.find((f) => f.tipo === 'materialas')?.url ?? m.fotos?.[0]?.url ?? null,
    imageCredit: 'AEMPS · CIMA',
  };
}

/**
 * Fetches one product by Spanish national code (CN) — used when a scanned Spanish box is not
 * in the catalogue yet. Returns null when CIMA does not know the code.
 */
export async function fetchCimaByCn(fetcher: typeof fetch, baseUrl: string, cn: string): Promise<ImportedMedicine | null> {
  const base = baseUrl.replace(/\/?$/, '/');
  const res = await fetcher(`${base}medicamento?cn=${encodeURIComponent(cn)}`, { signal: AbortSignal.timeout(8000) });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) throw new Error(`CIMA responded ${res.status}`);
  const text = await res.text();
  if (!text.trim()) return null;
  const json = JSON.parse(text) as CimaMedicamento;
  return json?.nregistro ? mapCimaMedicamento(json) : null;
}

/**
 * AEMPS CIMA REST API (Spain). Public, no key. Config:
 *   { query: { nombre?: string, practiv1?: string, atc?: string }, maxPages?: number }
 * Lists matching registrations, then fetches each detail record.
 */
export const cimaAdapter: DataAdapter = {
  key: 'cima',
  async sync(ctx: SyncContext): Promise<SyncResult> {
    const base = (ctx.source.url ?? 'https://cima.aemps.es/cima/rest/').replace(/\/?$/, '/');
    const query = (ctx.config.query as Record<string, string> | undefined) ?? {};
    const maxPages = Number(ctx.config.maxPages ?? 5);
    const result: SyncResult = { read: 0, created: 0, updated: 0, failed: 0 };
    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams({ ...query, comerc: '1', pagina: String(page) });
      const res = await ctx.fetch(`${base}medicamentos?${params}`);
      if (!res.ok) throw new Error(`CIMA list responded ${res.status}`);
      const list = (await res.json()) as { resultados: { nregistro: string }[]; totalFilas: number; tamanioPagina: number };
      for (const item of list.resultados ?? []) {
        result.read++;
        try {
          const detail = await ctx.fetch(`${base}medicamento?nregistro=${encodeURIComponent(item.nregistro)}`);
          if (!detail.ok) throw new Error(`detail ${detail.status}`);
          const outcome = await upsertImportedMedicine(ctx.prisma, ctx.source.id, mapCimaMedicamento(await detail.json()));
          outcome === 'created' ? result.created++ : result.updated++;
        } catch (e) {
          result.failed++;
          ctx.log(`CIMA ${item.nregistro} failed: ${(e as Error).message}`);
        }
      }
      if (page * list.tamanioPagina >= list.totalFilas) break;
    }
    return result;
  },
};
