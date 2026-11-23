# MedDexa

**Smarter Healthcare. Across Europe.**

MedDexa is a European platform for discovering pharmacies, searching medicines, comparing pharmaceutical products ingredient by ingredient, and comparing reference prices across countries. It is an **information and comparison platform, not a shop**: there is no cart, checkout, payment, reservation, delivery or order tracking anywhere in the product or the database.

| Part | Stack | Path |
| --- | --- | --- |
| Mobile app (Android + iOS) | Expo SDK 58, React Native 0.88, Expo Router, TypeScript, TanStack Query, Zustand, React Hook Form + Zod, i18next (12 languages), react-native-maps | `apps/mobile` |
| Backend API | NestJS 11, REST + OpenAPI, Prisma 6 (Rust-free client) on PostgreSQL 16, Redis cache, JWT + rotating refresh tokens, RBAC, rate limiting, Sentry, pino | `apps/api` |
| Admin dashboard | Next.js 15 (App Router), cookie-based staff sessions through a same-origin API proxy | `apps/admin` |
| Shared domain | Comparison engine, unit normalisation, currency conversion, Zod request schemas, API response types | `packages/shared` |
| Infrastructure | Docker Compose (Postgres, Redis, MinIO), Dockerfiles, GitHub Actions CI, EAS build profiles | repo root |

## Quick start

```bash
corepack enable                       # pnpm 10
pnpm install
pnpm build:shared                     # the API and admin consume packages/shared/dist

docker compose up -d postgres redis   # or use your own PostgreSQL 16 + Redis 7

cp apps/api/.env.example apps/api/.env
cd apps/api
npx prisma migrate deploy             # creates the schema, search indexes and checks
npx prisma db seed                    # reference data + labelled demo data + admin user
pnpm dev                              # API on http://localhost:3000 — docs at /docs

# in another terminal
cd apps/admin && cp .env.example .env.local && pnpm dev     # http://localhost:3001

# in another terminal
cd apps/mobile && cp .env.example .env && npx expo start    # press a / i, or scan with a dev build
```

The mobile app uses native modules (maps, secure storage), so it runs in a **development build** (`npx expo run:android` / `npx expo run:ios`, or `eas build --profile development`). Full instructions: [docs/SETUP.md](docs/SETUP.md).

Default development admin: `admin@meddexa.local` / `ChangeMe-Admin-2026` (from `apps/api/.env`; change it).

## What works today

- **Medicine search** — PostgreSQL full-text + trigram search over a denormalised document containing localized names, registrations, ingredient synonyms (e.g. *acetaminophen → paracetamol*, *Coffein → caffeine*), strengths and barcodes; filters for ingredients (all must match, salts match their moiety), manufacturer, ATC, form, route, prescription status, country, strength in any unit, pack size, barcode and registration number; suggestions; server-side pagination; price and rating sorting.
- **Comparison engine** — 2–6 products, reference-based; matches ingredients by active moiety, normalises strengths and concentrations, and reports missing/additional ingredients, salt, strength, concentration, form, release and route differences with severities. Composition (same ingredient / same combination / similar / none) and assessment (potentially equivalent / important differences / insufficient data / not comparable) are separate. Unknown data never counts as equal, and nothing is presented as a substitution recommendation. See [docs/COMPARISON_ENGINE.md](docs/COMPARISON_ENGINE.md).
- **European price comparison** — per-pharmacy and national price-list offers, local price, converted estimate with rate date and source, price per unit, availability, observation date, staleness, provenance and monthly history; countries without data are listed honestly.
- **Pharmacy discovery** — distance search with bounding-box prefilter, city/address/postcode/name/country search, open-now computed in each pharmacy's time zone (including overnight spans), services, rating and verification filters; profiles with hours, services, sub-ratings and provenance; call/website actions appear **only for verified details**.
- **Reviews** — separate medicine and pharmacy reviews (pharmacy sub-ratings), automatic pre-moderation (links, personal data, medical claims, abuse, shouting), helpful votes, reports (3 reports hide a review pending moderation), per-user daily limits. No review is ever seeded or imported.
- **Accounts** — guest use of everything; registration, login, rotating refresh tokens with reuse detection, password reset by email, favourites, search/comparison history, recently viewed, preferences, notifications, GDPR data export and account deletion.
- **Admin** — medicines with exact ingredient quantities, packages, registrations, synonyms and duplicate detection/merge; ingredients and moieties; manufacturers and forms; pharmacies, hours and services; prices (stale detection, verified updates with history) and availability; review moderation and reports; users and roles; provider configuration, readiness, manual sync and logs; country coverage; anonymous analytics; audit log of every change.
- **Data integrations** — modular adapters: ECB exchange rates, OpenStreetMap pharmacies (Overpass), AEMPS CIMA (Spain), BDPM (France), Google Places (on-demand only), plus a development demo source. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## Verified in this repository

| Check | Result |
| --- | --- |
| `packages/shared` Jest (comparison engine, units, currency, text) | 36 tests passing |
| `apps/api` unit tests (adapters, parsers, moderation, opening hours, env) | 20 tests passing |
| `apps/api` e2e tests against PostgreSQL 16 (search, compare, prices, pharmacies, auth, GDPR, reviews, admin, integrations) | 44 tests passing |
| `apps/mobile` Jest + React Native Testing Library (translations parity for 12 languages, compare store, components) | 20 tests passing |
| Type checks (shared, API, admin, mobile) and ESLint (API, mobile) | clean |
| `nest build`, `next build`, `expo export --platform web` | succeed |
| End-to-end click-through of the mobile app (web build, Playwright) and the admin dashboard against the running API | no runtime errors |

Not verified here (environment limits): native Android/iOS binaries (no emulator or Xcode in the build environment — use EAS or a local dev build), Maestro flows (`apps/mobile/.maestro`), Docker images (no Docker daemon), and live calls to external providers (outbound network to ECB/OSM/CIMA was blocked; the adapters are tested against documented and live-verified response shapes, and a failed live sync is logged as such).

## Data honesty

- Everything under the `demo` data source is **fictional** (brands like *Paradex*, *Ibudex*; "(demo)" manufacturers; "Demo Pharmacy …"), flagged `isDemo`, labelled "Demo data" in every app, refused in production, and excluded when `ALLOW_DEMO_DATA=false`.
- Prices without a verified source are shown as unavailable, never estimated. Converted prices are marked "≈" with the exchange-rate date and source.
- Safety sections and documents must come from official sources; the demo records contain only a placeholder notice, not medical text.

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — local setup, environment variables, builds (EAS), external API configuration
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design and decisions
- [docs/DATABASE.md](docs/DATABASE.md) — data model, indexes, provenance
- [docs/API.md](docs/API.md) — endpoints; machine-readable spec in [docs/openapi.json](docs/openapi.json)
- [docs/COMPARISON_ENGINE.md](docs/COMPARISON_ENGINE.md) — pharmaceutical comparison rules
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — provider research and adapter configuration
- [docs/TESTING.md](docs/TESTING.md) — test suites and how to run them
- [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md) — security, GDPR and regulatory notes
- [docs/DESIGN.md](docs/DESIGN.md) — brand and design system

MedDexa provides educational information and does not replace professional medical advice.
