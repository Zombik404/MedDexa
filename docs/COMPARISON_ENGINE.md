# Comparison engine

Source: `packages/shared/src/comparison/engine.ts` · tests: `engine.test.ts` (28 cases) and `apps/api/test/catalog.e2e-spec.ts`.

## Inputs

Each medicine is converted to a `ComparableMedicine`: form (code, name, **group**), route, release mechanism, prescription status, default package, and ingredients with `substanceId`, `moietyId` and a strength `{amount, unit, perAmount?, perUnit?, basis}`.

## Normalisation

- Mass → mg, volume → ml, activity → IU, amount → mmol, countable dose units → unit, and `%` kept separate. IU is **never** converted to mass.
- Strength = amount ÷ reference quantity, e.g. `100 mg / 5 ml` → `20 mg/ml`; `0.4 g` per tablet → `400 mg/unit`.
- Equality uses a relative tolerance of 1e-9 (floating-point noise only).
- Unknown or unparseable units return `null` — they are reported, not guessed.

## Matching

Ingredients are matched by **active moiety** (`moietyId`, falling back to the substance). Ibuprofen lysine and ibuprofen therefore share a row, but a `DIFFERENT_SALT` difference is always raised. Quantities are only compared when both are expressed on the same basis (substance vs moiety).

## Differences and severities

| Code | Severity |
| --- | --- |
| MISSING_INGREDIENT, ADDITIONAL_INGREDIENT, DIFFERENT_ROUTE, DIFFERENT_RELEASE | critical |
| DIFFERENT_STRENGTH, DIFFERENT_CONCENTRATION, DIFFERENT_SALT, DIFFERENT_FORM (other form group), INCOMPARABLE_STRENGTH, UNKNOWN_* | major |
| FORM_VARIANT (same form group, e.g. tablet vs film-coated tablet) | minor |
| DIFFERENT_PRESCRIPTION_STATUS, DIFFERENT_PACKAGE_SIZE, DIFFERENT_COUNTRY | info |

## Classification

Two independent results per pair (reference vs other):

**Composition** — `SAME_ACTIVE_INGREDIENT` (one shared moiety, identical sets), `SAME_COMBINATION` (identical multi-ingredient sets), `SIMILAR_COMPOSITION` (overlap but not identical), `NO_SHARED_INGREDIENTS`.

**Assessment**
1. `NOT_COMPARABLE` — no shared ingredient (or no ingredient data).
2. `IMPORTANT_DIFFERENCES` — any *known* critical or major difference. Known differences win over unknowns.
3. `INSUFFICIENT_DATA` — otherwise, if any strength, form, route or release is unknown.
4. `POTENTIALLY_EQUIVALENT` — identical moiety set, salts, normalised strengths, route, release and form group; only minor/info differences.

A combination is never equivalent to one of its ingredients; sharing an ingredient never implies interchangeability. The multi-product summary takes the worst assessment and composition across pairs.

## Presentation rules (apps)

- The banner always shows composition and assessment separately, with counts of critical/major differences.
- Every comparison view includes the disclaimer: *"This comparison describes pharmaceutical characteristics only. It is not a recommendation to substitute one medicine for another — ask your pharmacist or doctor."*
- "Potentially equivalent" is explained as *only a pharmacist or doctor can confirm whether one can replace the other.*
- Ingredient matrix cells are coloured by status (missing/additional = red, different/unknown = amber).

## Known limits

- Bioequivalence, excipients (e.g. lactose), device/inhaler differences and indications are not modelled; they require SmPC-level data and should be added as further difference codes.
- Cross-country ingredient identity depends on ingredient synonyms or a shared substance identifier. Production should map ingredients to EMA SPOR SMS substance IDs (see INTEGRATIONS.md).
