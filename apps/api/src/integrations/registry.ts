import type { DataAdapter } from './adapter';
import { bdpmAdapter } from './adapters/bdpm.adapter';
import { cimaAdapter } from './adapters/cima.adapter';
import { demoAdapter } from './adapters/demo.adapter';
import { ecbAdapter } from './adapters/ecb.adapter';
import { googlePlacesAdapter } from './adapters/google-places.adapter';
import { overpassAdapter } from './adapters/overpass.adapter';

/** Adapter registry. A DataSource row selects its adapter by key. */
export const ADAPTERS: Record<string, DataAdapter> = Object.fromEntries(
  [ecbAdapter, overpassAdapter, googlePlacesAdapter, cimaAdapter, bdpmAdapter, demoAdapter].map((a) => [a.key, a]),
);

/** Markets without any adapter yet; surfaced in the admin "unsupported countries" view. */
export const PLANNED_INTEGRATIONS: Record<string, string> = {
  HU: 'OGYÉI medicine database and NEAK public drug list (prices) — licence and access to be confirmed',
  DE: 'No free official product/price API (ABDA database is commercial); BfArM AMIce for authorisations',
  AT: 'BASG Arzneispezialitätenregister; prices via Erstattungskodex (Dachverband)',
  PL: 'Rejestr Produktów Leczniczych (open data) and reimbursement list (Ministry of Health)',
  IT: 'AIFA open data (Class A/H lists with prices)',
  NL: 'CBG-MEB Geneesmiddeleninformatiebank open data',
  BE: 'FAMHP/INAMI SAM authentic source (registration required)',
  PT: 'INFARMED Infomed',
  RO: 'ANMDMR nomenclator',
  CZ: 'SÚKL open data (DLP) including maximum prices',
  SK: 'ŠÚKL register and MoH reimbursement list',
};
