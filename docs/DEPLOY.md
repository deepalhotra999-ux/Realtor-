# Deploying the demo to Netlify (free)

The repo is ready to import. Nothing needs to be configured by hand.

## Steps

1. Sign in at [app.netlify.com](https://app.netlify.com) (free account).
2. **Add new project → Import an existing project → GitHub**, pick this repository and the
   `claude/realestate-marketplace-build-djzvsy` branch.
3. Leave the build settings as detected (they come from `netlify.toml`) and click **Deploy**.
4. When the deploy finishes, open the site URL. Sign in with a demo account:

| Role  | Email                 | Password   |
| ----- | --------------------- | ---------- |
| Admin | admin@dwellwise.local | admin12345 |
| Agent | agent@dwellwise.local | demo12345  |
| Buyer | buyer@dwellwise.local | demo12345  |

The first build takes a few minutes: it creates the database schema and loads the fictional demo data.

## What happens automatically

| Need                 | How it's handled on Netlify                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL + PostGIS | **Netlify DB** (Neon) is provisioned because the project depends on `@netlify/neon`; the app reads `NETLIFY_DATABASE_URL`. Neon supports PostGIS, `pg_trgm` and `pgcrypto`.     |
| Schema & demo data   | The build runs migrations, then seeds 240 fictional listings **only if the database is empty** — redeploys keep your data.                                                      |
| Secrets              | `scripts/netlify-prepare.mjs` generates `AUTH_SECRET` and a jobs token per deploy (git-ignored, server-only).                                                                   |
| Background jobs      | `netlify/functions/jobs-tick.mts` is a scheduled function that calls `/api/jobs/tick` every 10 minutes (saved-search alerts, lifting timed suspensions, verification expiry …). |
| Photo uploads        | Stored in **Netlify Blobs** (free, built in).                                                                                                                                   |
| Email / SMS          | No paid providers: messages are recorded in Admin → Notifications. **Demo mode** shows verification codes on screen and enables “Simulate approve” for identity checks.         |
| AI                   | Deterministic rule-based mode (no Ollama on Netlify). Every AI feature still works.                                                                                             |

## Free-tier caveats

- **Claim the database within 7 days.** An unclaimed Netlify DB is deleted after 7 days. Netlify shows a
  “Claim database” prompt (Project → Extensions → Neon); claiming connects it to a free Neon account and keeps it.
- Scheduled functions only run on the **published production** deploy, at most every 10 minutes.
- Server functions have a ~6 MB request limit, so upload photos a few at a time.
- The demo labels all listings, agents and reviews as fictional. Don't use `DEMO_MODE` on a real marketplace:
  it shows verification codes on screen.

## Using your own Postgres instead

Set `DATABASE_URL` in **Project configuration → Environment variables** (all scopes) to any Postgres 16 that
supports PostGIS (Neon, Supabase, …) and redeploy. It takes precedence over Netlify DB.

## Optional settings

Set these in the Netlify UI to override the built-in demo defaults: `AUTH_SECRET`, `JOBS_SECRET`,
`DEMO_MODE=false`, `STORAGE_PROVIDER`, `AI_PROVIDER`, `APP_URL`. See `.env.example` for everything else.

## Other hosts

Any Node host with Postgres works: `pnpm build`, then `pnpm db:migrate && pnpm db:seed && pnpm start`, and run
`pnpm worker` alongside (or set `RUN_WORKER_IN_WEB=true` on single-process hosts).
