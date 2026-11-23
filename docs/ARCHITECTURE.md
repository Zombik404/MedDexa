# Architecture

```
            ┌───────────────────────┐        ┌────────────────────────┐
            │  Mobile app (Expo)    │        │  Admin (Next.js)       │
            │  iOS · Android · web  │        │  staff only            │
            └──────────┬────────────┘        └───────────┬────────────┘
                       │ HTTPS  /v1  (JWT optional)      │ same-origin /api/proxy → /v1/admin (cookie session)
                       ▼                                 ▼
            ┌──────────────────────────────────────────────────────────┐
            │                    NestJS API (/v1)                      │
            │  auth · medicines/search · compare · prices/fx ·         │
            │  pharmacies · reviews · me · meta · admin · health       │
            │  ── integrations: adapter registry + scheduler ──        │
            └────┬────────────────┬─────────────────┬──────────────────┘
                 │ Prisma (pg)    │ ioredis         │ HTTPS (adapters)
                 ▼                ▼                 ▼
          PostgreSQL 16       Redis 7        ECB · OSM Overpass · CIMA · BDPM ·
          (FTS + pg_trgm)    (cache)         Google Places (live) · Expo Push
```

## Monorepo

- `packages/shared` is framework-free TypeScript: the **comparison engine**, unit normalisation, currency maths, Zod request schemas and API response types. The API validates with the same schemas the apps use for forms, so contracts cannot drift.
- `apps/api` — NestJS modules per domain. Every route is public unless marked `@RequireAuth()` or `@Roles()`; a global guard still attaches the user when a token is sent, so guests and members use the same endpoints.
- `apps/mobile` — Expo Router (`src/app`), feature components in `src/components`, server state in TanStack Query, client state in small Zustand stores persisted with AsyncStorage (secrets in SecureStore).
- `apps/admin` — Next.js App Router. Tokens never reach the browser: the login route handler stores them in httpOnly cookies and `/api/proxy/[...path]` forwards requests with the bearer token, refreshing once on 401.

## Key decisions

| Decision | Reason |
| --- | --- |
| Rust-free Prisma client (`engineType = "client"` + `@prisma/adapter-pg`) | No native query-engine binary to ship; standard pg driver; Prisma 7-ready |
| PostgreSQL full-text + pg_trgm instead of a separate search engine | Catalogue size per market is in the tens of thousands of presentations; one store keeps provenance, joins and filters consistent. The search document is denormalised (`medicines.searchText`, generated `searchVector`) so the engine can be swapped for OpenSearch/Meilisearch later behind `SearchService` |
| Central medicine identity + `ProductRegistration` per country + `MedicinePackage` per presentation | One product can be registered in many countries under different names without duplicating its identity; prices attach to packages |
| Offers with nullable pharmacy | A national price list (e.g. regulated maximum price) and a single pharmacy's price share one model |
| Comparison engine in `packages/shared` | Pure, deterministic, unit-tested; the API runs it, and the apps can reuse it offline |
| Provider adapters behind one interface + `DataSource` rows | Providers can be added, configured, disabled or replaced without touching the core |
| Anonymous `AnalyticsEvent` table | Product analytics without personal data; personal history only for signed-in users who keep it enabled |
| Refresh-token rotation with reuse detection | Stolen refresh tokens are detected and the whole session family is revoked |

## Request flow examples

**Search** — `GET /v1/medicines/search?q=coffein&country=HU&currency=HUF` → Zod validation → `SearchService` builds one SQL query (tsquery prefix match OR trigram similarity, plus filters, price in EUR via the latest rate table for sorting) → ids → `MedicinesService.summaries` loads relations, ratings and the lowest fresh price converted to HUF → page. Signed-in users with history enabled get a `SearchHistory` row; an anonymous `AnalyticsEvent` is always written.

**Compare** — `POST /v1/compare {medicineIds}` → load medicines with ingredients/moieties/forms/packages → `toComparable()` → `compareMedicines()` → summaries + best offer per medicine → optional history row.

## Scaling notes

- The API is stateless (JWT, Redis cache) and can be scaled horizontally; run the scheduler on one instance (`ENABLE_SCHEDULER=false` elsewhere).
- Rate limiting uses the in-memory throttler store per instance; switch to a Redis store when running several instances.
- Overpass and BDPM imports are batch jobs; for large countries run them from a worker (`pnpm sync <id>`) rather than the request path.
