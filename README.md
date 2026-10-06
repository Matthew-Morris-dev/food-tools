# Food Tools

Self-hosted calorie tracking, meal planning and shopping lists. One mobile app (Expo) talking to your own server (a small TypeScript API and Postgres in Docker). See [docs/SPEC.md](docs/SPEC.md) for the product spec and roadmap.

Status: early. The calorie counter works: search, barcode scan, quick add, custom foods, and a daily log by meal. Goals, the meal planner and the shopping list are next.

## Run the server

```sh
docker compose up -d
```

The API comes up on port 3000 with Postgres behind it. No configuration is needed to start; an auth secret is generated on first run and kept in a Docker volume. To change ports, passwords or URLs, copy `.env.example` to `.env` and edit it.

To use the app from a phone, set `BETTER_AUTH_URL` in `.env` to the address the phone uses to reach the server (e.g. `http://192.168.1.10:3000`). Once your accounts exist, set `DISABLE_SIGNUP=true` so nobody else can register.

## Develop

Requires Node 24 and Docker.

```sh
npm install
cp .env.example .env
npm run dev:db      # Postgres only, on localhost:5432
npm run dev:api     # API with reload, on localhost:3000
npm run dev:mobile  # Expo dev server; press w for web, or scan the QR code
```

For a phone on your network, create `apps/mobile/.env` from `apps/mobile/.env.example` with your machine's LAN address.

| Path | What it is |
| --- | --- |
| `apps/api` | Hono API, Better Auth, Drizzle schema and migrations |
| `apps/mobile` | Expo app (Expo Router, screens under `src/app`) |
| `docs/SPEC.md` | Product spec |

The generic food list in `apps/api/data/cofid.json` is built from the CoFID spreadsheet with `npm run build:cofid -w apps/api`, and loads into the database when the API starts.

After changing the schema in `apps/api/src/db`, run `npm run db:generate -w apps/api` to create a migration. Migrations apply automatically when the API starts.

Checks: `npm run typecheck` and `npm run lint`.

## Food data

- Generic foods: McCance and Widdowson's Composition of Foods Integrated Dataset 2021 ([CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid)). Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
- Packaged foods: [Open Food Facts](https://world.openfoodfacts.org), available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/1-0/). Products are fetched on demand (barcode scans and explicit searches) and cached in your own database.
