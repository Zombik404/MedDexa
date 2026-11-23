# Database

PostgreSQL 16 with Prisma 6. Schema: `apps/api/prisma/schema.prisma`; migration: `apps/api/prisma/migrations/20261123120000_init/migration.sql` (Prisma-generated DDL plus hand-written extensions, search indexes and CHECK constraints at the end of the file).

## Entities

| Group | Tables |
| --- | --- |
| Reference | `countries`, `languages`, `currencies`, `exchange_rates`, `pharmaceutical_forms` (with form **group** and EDQM code), `atc_classes` (tree), `pharmacy_services` |
| Users | `users`, `user_preferences`, `sessions` (hashed refresh tokens), `password_reset_tokens` |
| Pharmaceutical | `manufacturers`, `active_ingredients` (self-relation `moietyId` for salts/esters), `ingredient_synonyms`, `medicines`, `ingredient_quantities` (exact amount, unit, per-amount, per-unit, basis), `medicine_packages`, `product_registrations`, `product_synonyms`, `medicine_documents`, `safety_sections` |
| Pharmacies | `pharmacies`, `opening_hours`, `pharmacy_service_links` |
| Prices | `pharmacy_offers` (package × pharmacy-or-national-list × source), `prices` (current), `price_snapshots` (history), `availability_records` |
| Reviews | `reviews` (medicine or pharmacy, sub-ratings, moderation), `review_votes`, `review_reports` |
| Integration | `data_sources`, `data_sync_logs` |
| Personal | `favorites`, `search_history`, `comparison_history`, `recently_viewed`, `notifications`, `push_tokens` |
| Operations | `analytics_events` (anonymous), `audit_logs` |

There are intentionally **no** orders, payments, carts, deliveries, couriers or reservations.

## Identity model

`Medicine` = one pharmaceutical product (composition, form, route, release). Country names and numbers live in `ProductRegistration` and `ProductSynonym`; presentations in `MedicinePackage`. Prices attach to packages through `PharmacyOffer`. A duplicate record is linked with `duplicateOfId` and archived, never silently deleted.

## Provenance

`medicines`, `pharmacies`, `product_registrations`, `medicine_documents`, `safety_sections` and `pharmacy_offers` carry `sourceId`, `sourceReference`, `syncedAt`, `verification` (`VERIFIED | UNVERIFIED | OUTDATED | DEMO`) and, where relevant, `confidence` and `isDemo`. `(sourceId, sourceReference)` is unique, which makes imports idempotent.

## Search

- `medicines.searchText` — normalised (diacritic-free, lowercase) document rebuilt by `refreshSearchText()` whenever a medicine, its ingredients, synonyms, registrations or packages change.
- `medicines.searchVector` — `GENERATED ALWAYS AS (to_tsvector('simple', searchText)) STORED`, GIN-indexed.
- Trigram GIN indexes on `searchText` and on normalised names of synonyms, ingredients, manufacturers and pharmacies for fuzzy matching.

## Integrity

CHECK constraints: review ratings 1–5, a review targets exactly one medicine **or** pharmacy, favourites/recently-viewed target exactly one entity, opening-hour day 0–6, coordinates in range, non-negative prices, positive pack quantities and exchange rates. Foreign keys cascade only from owning records (e.g. deleting a user removes their personal data and reviews; audit rows keep a null actor).

## Migrations

```bash
npx prisma migrate deploy                     # apply
npx prisma migrate dev --create-only --name x # new migration; re-check custom SQL if touching medicines
```
