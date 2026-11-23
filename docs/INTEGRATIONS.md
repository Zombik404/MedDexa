# Data integrations — research and configuration

Every provider sits behind the `DataAdapter` interface (`apps/api/src/integrations/adapter.ts`) and is selected by a `DataSource` row. Adapters write only through Prisma and always set `sourceId`, `sourceReference`, `syncedAt` and `verification`. Shared import logic (ingredient/moiety matching, registrations, packages, price snapshots, documents, search text) is in `integrations/importer.ts`, so a new national source is mostly a parser.

Status legend: **Implemented** = adapter + tests in this repo · **Planned** = researched, not implemented · ✔ = verified during development (Nov 2026) · ? = to be confirmed with the provider before production.

> Licensing statements below are a starting point for legal review, not legal advice. Re-check each provider's current terms before commercial launch.

## Implemented adapters

### European Central Bank — euro reference rates (`ecb-fx`, adapter `ecb`)

1. **Data:** daily EUR reference rates for ~30 currencies (incl. HUF, PLN, CZK, RON, GBP, CHF, SEK, DKK, NOK, USD; *not* UAH).
2. **Public API:** yes — `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml` (also the ECB Data Portal API).
3. **Commercial use:** ECB statistics may be reused with source attribution ("Source: ECB") ?.
4. **Registration/payment:** none.
5. **Coverage:** global currencies against EUR.
6. **Updates:** working days around 16:00 CET; scheduled sync at 17:15 Europe/Berlin.
7. **Limits:** reference rates only (not transaction rates); no weekend/holiday rates → MedDexa uses the latest available date and shows it.
8. **Notes:** parser tested against the published XML structure. UAH conversion needs a second source (e.g. National Bank of Ukraine) — until then conversions to UAH return "no rate" rather than a guess.

### OpenStreetMap via Overpass (`osm-overpass`, adapter `overpass`)

1. **Data:** `amenity=pharmacy` nodes/ways with name, address, phone, website, `opening_hours`, wheelchair.
2. **Public API:** Overpass API (public instances; self-host for production volume).
3. **Commercial use:** yes under **ODbL 1.0** — attribution "© OpenStreetMap contributors"; a derived database that is *publicly distributed* must be offered under ODbL (share-alike) ✔ (well-known licence; confirm the "produced work vs derivative database" position with counsel).
4. **Registration/payment:** none; public instances have fair-use limits.
5. **Coverage:** all of Europe, completeness varies by country/city.
6. **Updates:** continuous; MedDexa syncs weekly per configured country.
7. **Limits:** crowd-sourced — stored as `UNVERIFIED`, contact details not marked verified, `opening_hours` parsed only for common patterns (unparsed → "hours unknown"). Large countries need a self-hosted Overpass or a planet extract.
8. **Config:** `{ "countries": ["HU","AT"] }`. Mapping + opening-hours parser covered by unit tests.

### AEMPS CIMA — Spain (`cima-es`, adapter `cima`)

1. **Data:** authorised medicines with active ingredients and exact quantities (`principiosActivos[].cantidad/unidad`), ATC, routes, pharmaceutical form, prescription flag, presentations (national code), SmPC/PIL document links, photos.
2. **Public API:** yes — REST `https://cima.aemps.es/cima/rest/medicamentos` and `/medicamento?nregistro=` ✔ (response structure verified against the live API).
3. **Commercial use:** AEMPS publishes CIMA as a public information service; reuse conditions ? (confirm with AEMPS; Spain's public-sector reuse law generally allows reuse with attribution).
4. **Registration/payment:** none.
5. **Coverage:** Spain.
6. **Updates:** continuous; weekly sync recommended.
7. **Limits:** **no prices** in CIMA (Spanish prices come from the Ministry of Health *Nomenclátor* — planned). Ingredient names are Spanish INN variants ("ACETILSALICILICO ACIDO"); cross-country identity relies on ingredient synonyms → map to EMA SPOR substances.
8. **Config:** `{ "query": { "practiv1": "ibuprofeno" } | { "atc": "N02BE01" } | { "nombre": "…" }, "maxPages": 5 }`.

### Base de données publique des médicaments — France (`bdpm-fr`, adapter `bdpm`)

1. **Data:** specialities (`CIS_bdpm.txt`), presentations with CIP13 and **regulated price** of reimbursed packs (`CIS_CIP_bdpm.txt`), compositions with active substance (SA) / therapeutic fraction (FT) and dosage reference (`CIS_COMPO_bdpm.txt`), prescription conditions.
2. **Public API:** downloadable tab-separated files (no header) from `base-donnees-publique.medicaments.gouv.fr` ✔ (column layout from ANSM's "Contenu et format des fichiers téléchargeables dans la BDM v3").
3. **Commercial use:** published by the French state as public data; the exact licence is not stated on the format document ? — confirm with ANSM/HAS before commercial use.
4. **Registration/payment:** none.
5. **Coverage:** France.
6. **Updates:** regularly (several times per month).
7. **Limits:** prices only for reimbursed presentations (shown as "Regulated price"); OTC prices are free-set by pharmacies and not published. Older files are Windows-1252 encoded (handled).
8. **Config:** `{ "directory": "/path/to/files" }` or `{ "baseUrl": "…" }`, optional `"limit"`. FT→moiety mapping covered by tests.

### Google Maps Platform — Places API (New) (`google-places`, adapter `google-places`)

1. **Data:** place id, name, address, coordinates (and, with more field masks, phone, hours, website, ratings).
2. **Public API:** yes, `places:searchNearby`.
3. **Commercial use:** yes under the Google Maps Platform terms; for EEA customers the **EEA Service Specific Terms** apply ✔: latitude/longitude may be cached for up to 30 days, `place_id` may be cached, other Places content may only be used as allowed by the "Places API EEA Permitted Uses", and Places content other than lat/lng/place_id must not be used "with any Map" (non-Google map). Must be reviewed before displaying Places results on the in-app map.
4. **Registration/payment:** Google Cloud billing account and API key (pay-per-request).
5. **Coverage:** worldwide; not every pharmacy is listed and listings are not authoritative.
6. **Updates:** live.
7. **Limits:** therefore implemented as **on-demand only** (`GET /v1/pharmacies/external/google`), never persisted, disabled by default.
8. **Config:** env `GOOGLE_MAPS_API_KEY`.

### Demo (`demo`)

Fictional development data only (see README "Data honesty"). Cannot run in production.

## Planned providers (researched)

| Provider | Data | Access | Commercial use | Notes |
| --- | --- | --- | --- | --- |
| **EMA** — medicines data download, ePI, SPOR (SMS/PMS) | Centrally authorised products, EPAR links, product information; SPOR substance identifiers | Downloadable tables; SPOR API requires an EMA account | EMA legal notice allows reuse with acknowledgement ? | SPOR SMS ids are the recommended cross-country ingredient identity |
| **Hungary** — OGYÉI medicine database; NEAK published drug lists | Authorisations, SmPC/PIL (OGYÉI); reimbursed products with prices (NEAK) | Web search portal (OGYÉI); NEAK publishes data files for reimbursed products ? | ? | Highest priority for the home market; confirm machine-readable access and reuse terms |
| **Czech Republic** — SÚKL open data | Medicinal product database (DLP), reimbursed list with maximum prices | Open-data files ✔ (SÚKL publishes open data and documents the data interfaces of the reimbursed list) | Open data with reuse consent ✔ | Good candidate for a second price adapter |
| **Poland** — Rejestr Produktów Leczniczych; reimbursement list (Ministry of Health) | Authorisations; reimbursed prices | Open data (XML/CSV) ? | ? | |
| **Italy** — AIFA open data | Class A/H lists with prices, packages (AIC) | Open data CSV ? | IODL licence ? | |
| **Germany** — BfArM AMIce; ABDA-Artikelstamm | Authorisations (AMIce); PZN, prices, availability (ABDA — commercial) | AMIce limited; ABDA via licensed data providers | ABDA requires a commercial licence | No free official price data |
| **Austria** — BASG register; Erstattungskodex | Authorisations; reimbursed prices | ? | ? | |
| **Netherlands** — CBG-MEB Geneesmiddeleninformatiebank | Authorisations, SmPC/PIL | Open data ? | ? | Prices (G-Standaard) are commercial |
| **Belgium** — FAMHP/INAMI SAM | Authentic source incl. prices | Registration required | ? | |
| **Portugal** — INFARMED Infomed | Authorisations, prices | Web portal ? | ? | |
| **Romania** — ANMDMR nomenclator; CANAMED (prices) | Authorisations; maximum prices | Files ? | ? | |
| **Slovakia** — ŠÚKL; MoH categorisation list | Authorisations; reimbursed prices | Files ? | ? | |
| **National pharmacy registries** (e.g. FINESS in France, national chamber lists) | Authoritative pharmacy lists | Varies; FINESS is open data ? | Varies | Preferred over OSM where available; mark records `VERIFIED` |
| **Apple MapKit** | Map rendering on iOS | Used through `react-native-maps` (Apple Maps provider) | Apple Developer terms | MapKit JS / Server API could geocode for the admin |

Unsupported countries are listed in **Admin → Data integrations → Country coverage** with the planned source.

## Adding a provider

1. Implement `DataAdapter` in `src/integrations/adapters/<name>.adapter.ts` (pure parse/map functions + a `sync()` that calls `upsertImportedMedicine` or writes pharmacies/prices).
2. Register it in `integrations/registry.ts`, declare `requiredEnv`/`requiredConfig`.
3. Add a `DataSource` row (seed or admin) with licence and attribution text.
4. Add unit tests with real sample payloads.
5. Enable it in the admin dashboard and watch the sync logs.
