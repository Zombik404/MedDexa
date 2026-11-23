# Testing

| Suite | Location | Tool | What it covers |
| --- | --- | --- | --- |
| Comparison engine & domain | `packages/shared/src/**/*.test.ts` | Jest + ts-jest | single/multi-ingredient products, quantities in different units, concentrations, form variants vs form groups, release mechanisms, routes, salts/moieties, missing data, duplicates across countries, matrix statuses, currency conversion, rounding, unit normalisation, text normalisation |
| API unit | `apps/api/src/**/*.spec.ts` | Jest | ECB XML parsing, OSM mapping and opening-hours parser, CIMA and BDPM mappers, Google Places mapping, national form/route mapping, dose/price parsing, tsquery builder safety, opening-hours across time zones and midnight, review moderation, env validation |
| API e2e | `apps/api/test/*.e2e-spec.ts` | Jest + Supertest + PostgreSQL | search (synonyms, typos, localized names, multi-ingredient, salts, strength units, barcode, registration, ATC, form, country, pagination, price sort, validation), suggestions, details, price comparison & conversions, compare (combination vs single, salts, release, invalid input), similar products, pharmacies (distance, city, postcode, address, country, services, open now, verified-only, unverified contact actions), auth (validation, duplicates, refresh rotation and reuse detection, protected routes, password reset), personal data (preferences, favourites, history, comparisons, recently viewed, history opt-out, GDPR export without secrets, account deletion), reviews (moderation, duplicates, sub-ratings, helpful votes, reports hiding), admin (RBAC, medicine creation with exact quantities, audit log, duplicate detection, stale prices and history, moderation, role management, integration readiness and logs, coverage, anonymous analytics), and the absence of commerce endpoints |
| Mobile unit/UI | `apps/mobile/src/__tests__` | Jest (jest-expo) + React Native Testing Library | translation parity across 12 languages (keys, placeholders, plural categories, weekdays), compare selection store, MedicineCard rendering and compare toggle, assessment banner wording |
| Mobile E2E | `apps/mobile/.maestro/*.yaml` | Maestro | onboarding → search, building a comparison, pharmacy search with filters |
| Admin | `apps/admin` | `tsc` + `next build` | type safety and production build; behaviour covered by API e2e tests |

## Running

```bash
pnpm build:shared
pnpm --filter @meddexa/shared test

# API (needs PostgreSQL; the e2e setup recreates the schema of the test database)
createdb meddexa_test
cd apps/api
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/meddexa_test npx jest --runInBand
npx jest --selectProjects unit          # unit only, no database

cd apps/mobile && npx jest
maestro test apps/mobile/.maestro        # with a development build installed on a device/emulator
```

The e2e global setup drops and recreates the `public` schema of `TEST_DATABASE_URL`, applies every migration's SQL in order and runs the seed with demo data. Never point it at a real database.

## API collections

Import `docs/openapi.json` into Bruno or Postman to get a ready collection for manual testing.
