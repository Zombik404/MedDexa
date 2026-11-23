# Setup, build and configuration

## Requirements

- Node.js 20.19+ (22 LTS recommended) and pnpm 10 (`corepack enable`)
- PostgreSQL 16 and Redis 7 (via `docker compose up -d postgres redis`, or your own)
- Mobile: Android Studio (emulator + SDK) and/or Xcode 16+ on macOS, or an Expo account for cloud builds (EAS)
- Optional: Maestro CLI for mobile E2E flows

## 1. Install

```bash
corepack enable
pnpm install
pnpm build:shared
```

The workspace uses `node-linker=hoisted` (see `.npmrc`) because React Native's Metro bundler expects a flat `node_modules`. All apps share one React version.

## 2. Database and API

```bash
docker compose up -d postgres redis
cp apps/api/.env.example apps/api/.env      # adjust secrets
cd apps/api
npx prisma migrate deploy                   # schema + search indexes + CHECK constraints
npx prisma db seed                          # reference data; demo data when SEED_DEMO=true
pnpm dev                                    # http://localhost:3000, Swagger UI at /docs
```

Useful scripts (from `apps/api`):

| Command | Purpose |
| --- | --- |
| `pnpm openapi` | Regenerates `docs/openapi.json` |
| `pnpm sync <sourceId>` | Runs one provider sync from the CLI, e.g. `pnpm sync ecb-fx` |
| `pnpm test` | Unit + e2e tests (needs PostgreSQL; see docs/TESTING.md) |
| `npx prisma studio` | Browse the database |

### Environment variables (API)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 random characters |
| `REDIS_URL` | no | Enables the shared Redis cache (otherwise in-process cache) |
| `CORS_ORIGINS` | no | Comma-separated origins (admin, Expo web) |
| `PUBLIC_APP_URL` | no | Deep-link prefix for password reset emails (`meddexa://`) |
| `SMTP_URL` | prod | e.g. `smtps://user:pass@smtp.example.com:465`; without it emails are logged in development |
| `SENTRY_DSN` | no | Error tracking |
| `PRICE_STALE_DAYS` | no | Prices older than this are labelled outdated (default 30) |
| `ALLOW_DEMO_DATA` | no | Must be `false` in production — start-up fails otherwise |
| `ENABLE_SCHEDULER` | no | Scheduled syncs (ECB weekdays 17:15 CET, others weekly) |
| `GOOGLE_MAPS_API_KEY` | no | Enables the on-demand Google Places endpoint |
| `EXPO_ACCESS_TOKEN` | no | Authenticated Expo push sending |
| `SEED_DEMO`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seed only | Demo data and first admin account |

## 3. Admin dashboard

```bash
cd apps/admin
cp .env.example .env.local     # API_URL=http://localhost:3000
pnpm dev                       # http://localhost:3001
```

Sign in with a MODERATOR, EDITOR or ADMIN account. Tokens are kept in httpOnly cookies; the browser talks to `/api/proxy/v1/*` only. Set `COOKIE_SECURE=true` behind HTTPS.

## 4. Mobile app

```bash
cd apps/mobile
cp .env.example .env           # EXPO_PUBLIC_API_URL (Android emulator: http://10.0.2.2:3000)
npx expo run:android           # builds and installs a development build
npx expo run:ios               # macOS + Xcode
npx expo start                 # Metro bundler for an installed development build
```

`react-native-maps`, `expo-secure-store`, `expo-location` and push notifications need a development build — Expo Go is not sufficient for the full app.

### Maps

- **iOS** uses Apple Maps by default (no key needed). Set `GOOGLE_MAPS_IOS_API_KEY` to use Google Maps instead.
- **Android** uses Google Maps and requires `GOOGLE_MAPS_ANDROID_API_KEY` (Maps SDK for Android enabled, restricted to package `app.meddexa` and your signing-certificate SHA-1).

### Cloud builds (EAS)

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas init                                       # sets EAS_PROJECT_ID
eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value … --environment production
eas build --profile development --platform android
eas build --profile preview --platform all     # internal testing (APK / ad-hoc)
eas build --profile production --platform all
eas submit --platform all
```

Push notifications: upload FCM V1 service-account credentials (`eas credentials` → Android → Push Notifications) and an APNs key (iOS). The API sends through the Expo Push Service, which delivers via FCM and APNs.

## 5. Everything in containers

```bash
cp apps/api/.env.example apps/api/.env
docker compose --profile app up --build       # postgres, redis, minio, api, admin
```

The API image runs `prisma migrate deploy` before starting.

## 6. Enabling real data providers

Providers are rows in `data_sources` (seeded) with an adapter. Configure them in **Admin → Data integrations**:

| Source id | What to configure | Notes |
| --- | --- | --- |
| `ecb-fx` | nothing | Enabled by default; syncs on ECB working days |
| `osm-overpass` | config `{ "countries": ["HU", "AT"] }`, then enable | Data is ODbL; display "© OpenStreetMap contributors". Use a self-hosted Overpass instance for production volumes |
| `cima-es` | config `{ "query": { "practiv1": "ibuprofeno" }, "maxPages": 5 }` | Public REST API, no key |
| `bdpm-fr` | config `{ "directory": "/data/bdpm" }` (downloaded files) or `{ "baseUrl": "…" }` | Confirm reuse terms with ANSM first |
| `google-places` | env `GOOGLE_MAPS_API_KEY` | On-demand only; check EEA permitted uses before showing results (docs/INTEGRATIONS.md) |

Then press **Run sync now**, or run `pnpm sync <id>`. Each run writes a `data_sync_logs` row with counts and errors. A provider with missing configuration is reported as `SKIPPED` with the exact missing setting.

Before going live, set `ALLOW_DEMO_DATA=false`; demo rows can be removed with `DELETE FROM medicines WHERE "isDemo"; DELETE FROM pharmacies WHERE "isDemo";`.
