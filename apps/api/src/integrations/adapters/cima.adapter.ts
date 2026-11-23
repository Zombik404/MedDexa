import type { DataAdapter, SyncContext, SyncResult } from '../adapter';
import { upsertImportedMedicine, type ImportedMedicine } from '../importer';
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
    formCode,
    route: mapRoute(m.viasAdministracion?.[0]?.nombre),
    release: releaseFromForm(formCode, m.formaFarmaceutica?.nombre),
    prescription: m.receta === true ? 'RX' : m.receta === false ? 'OTC' : 'UNKNOWN',
    ingredients: (m.principiosActivos ?? [])
      .slice()
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((p) => ({ name: p.nombre, ...parseCimaStrength(p.cantidad, p.unidad) })),
    // CIMA presentations carry the national code but no price.
    packages: [],
    documents: (m.docs ?? [])
      .filter((d) => d.tipo === 1 || d.tipo === 2)
      .map((d) => ({
        kind: d.tipo === 1 ? ('SMPC' as const) : ('PIL' as const),
        title: d.tipo === 1 ? 'Ficha técnica' : 'Prospecto',
        language: 'es',
        url: d.url,
      })),
    imageUrl: m.fotos?.find((f) => f.tipo === 'materialas')?.url ?? m.fotos?.[0]?.url ?? null,
  };
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
