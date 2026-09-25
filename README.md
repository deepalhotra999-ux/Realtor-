# Dwellwise

An open, **free-first** real-estate marketplace for buying, renting, selling, agents, brokers and property managers.

It runs locally with **zero paid API keys**. Every external capability sits behind a provider interface with a
free/local/open-source default, so you can swap in hosted services later without touching product code.

| Capability    | Default (free)                                  | Swap-in later                        |
| ------------- | ----------------------------------------------- | ------------------------------------ |
| Database      | PostgreSQL 16 + PostGIS                         | —                                    |
| Search        | Postgres full-text + PostGIS                    | Meilisearch / Typesense / OpenSearch |
| Maps          | Leaflet + OpenStreetMap tiles                   | Self-hosted tiles, MapLibre, …       |
| Geocoding     | Offline gazetteer (or Nominatim)                | Pelias, Photon, commercial geocoders |
| AI            | Ollama (Llama / Qwen / Mistral) → mock fallback | Any OpenAI-compatible / hosted model |
| Storage       | Local disk (or MinIO)                           | S3, R2, GCS                          |
| Email / SMS   | Database outbox (or SMTP via Mailpit)           | SES, Postmark, Twilio, …             |
| Property data | Fictional seed generator                        | RESO Web API / MLS / IDX feeds       |
| Payments      | Mock checkout (no money moves)                  | Stripe, Paddle, …                    |
| Auth          | Built-in (scrypt + DB sessions)                 | OIDC / SSO                           |

> **Demo data:** all listings, agents, brokerages and reviews are fictional and generated locally.
> Dwellwise does not include or claim to have MLS data.

## Host the demo on Netlify (free)

Import this repository in Netlify and deploy — the database, schema, demo data, secrets, photo storage
and background jobs are set up automatically. See [docs/DEPLOY.md](docs/DEPLOY.md).

## Quick start

Prerequisites: Node.js ≥ 20.9, pnpm, and PostgreSQL 16 with PostGIS (Docker is the easiest way).

```bash
pnpm install
docker compose up -d db          # Postgres + PostGIS on :5432
cp .env.example .env             # optional — every value has a free default
pnpm setup                       # migrate + seed fictional demo data
pnpm dev                         # http://localhost:3000
```

Demo accounts (created by the seed):

| Email                   | Password     | What you can do                                 |
| ----------------------- | ------------ | ----------------------------------------------- |
| `buyer@dwellwise.local` | `demo12345`  | Favorites, saved searches, shared boards        |
| `agent@dwellwise.local` | `demo12345`  | Pro workspace: listings, leads CRM, tours       |
| `admin@dwellwise.local` | `admin12345` | Admin panel: settings, plans, flags, moderation |

### Optional: local AI with Ollama

```bash
docker compose --profile ai up -d ollama
docker compose exec ollama ollama pull llama3.2
```

With `AI_PROVIDER=auto` (default) the app uses Ollama whenever it is reachable and falls back to a deterministic,
fact-grounded mock otherwise — every AI feature keeps working either way.

## Scripts

| Command            | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Development server                                  |
| `pnpm check`       | Typecheck → lint → tests → production build         |
| `pnpm db:generate` | Generate a migration from `src/server/db/schema.ts` |
| `pnpm db:migrate`  | Apply migrations                                    |
| `pnpm db:seed`     | Wipe app tables and load fictional demo data        |
| `pnpm db:reset`    | Drop everything, migrate, seed                      |
| `pnpm db:studio`   | Drizzle Studio                                      |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — layers, directories, request flow, data model
- [Providers](docs/PROVIDERS.md) — every external-service interface and how to add an adapter
- [Subscriptions](docs/SUBSCRIPTIONS.md) — free mode, plans → entitlements → features, payments
- [AI](docs/AI.md) — local models, grounding rules, fallbacks
- [Roadmap](docs/ROADMAP.md) — delivery phases and status
