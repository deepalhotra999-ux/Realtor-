# Roadmap

Each phase ends with `pnpm check` (typecheck, lint, tests, production build) passing and a commit.

## Phase 1 — Foundation ✅

- Next.js 16 + TypeScript + Tailwind v4 scaffold, ESLint, Prettier, Vitest
- Environment config with free defaults for every variable (`src/lib/env.ts`)
- PostgreSQL + PostGIS schema for the whole domain (Drizzle) and SQL migrations
- Provider interfaces + free implementations: AI (Ollama/mock), Map (OSM), Geocoding (offline/Nominatim),
  Storage (local/MinIO), Email (outbox/SMTP), SMS (outbox), Search (Postgres), Property data (seed/RESO),
  Payments (mock)
- Free-first settings, feature flags, Plans → Entitlements → Features engine
- Self-hosted auth (scrypt, DB sessions), roles and guards
- Deterministic fictional seed data + original SVG demo illustrations
- Design system foundations, site chrome, auth pages, health endpoint

## Phase 2 — Marketplace ✅

- Home page with hero search (place autocomplete + natural-language detection), featured homes, markets
- Map + list split search: price/beds/type/more filters, sort, pagination, "search as I move the map",
  hover sync, dense-area dot mode, mobile map/list toggle, saved searches with alert frequency
- Natural-language search → structured filters (rule-based parser, optional Ollama refinement, zod-validated)
- Property detail: gallery + lightbox, facts, monthly cost estimator, price history, location map,
  grounded AI Q&A, tour scheduling + messaging (creates CRM leads, conversations, notifications), similar homes
- Favorites, compare (up to 4, computed + optional AI-phrased summary), mortgage & affordability calculator
- Agent directory with filters, agent profiles with reviews (moderated) and direct contact
- Market insights per city (inventory, $/sqft, days listed, sale-to-list, price distribution, trend, neighborhoods)
- AI Home Finder: conversational preferences → transparent match scores with reasons and trade-offs
- Seller page with a comps-based value estimator that shows its comparables

## Phase 3 — Admin panel ✅

- Shell/nav, overview dashboard, users, agents/brokerages, listings (incl. approving drafts), leads,
  review moderation, trust & safety reports, audit log, `proxy.ts` optimistic auth redirects
- Settings (`/admin/settings`: General · Monetization · AI tabs), plans & feature catalogue
  (`/admin/plans`), subscriptions & trials (`/admin/subscriptions`: grant, extend trial, cancel, payments),
  feature flags (`/admin/flags`), AI (`/admin/ai`: stats, switches, playground), notifications outbox
  (`/admin/notifications`: test email), analytics (`/admin/analytics`: 7/30/90-day views, inquiries,
  funnel, top listings, searched cities)

**Correlated-subquery column bug — fixed.** Root cause (verified in `drizzle-orm/pg-core/dialect.js`
`buildSelection`): in a select with **no joins** (`isSingleTable`), Drizzle renders every column
reference in the SELECT list unqualified — including `${table.col}` inside a `sql` subquery — so
`where l.agent_id = ${users.id}` becomes `= "id"`, which Postgres resolves against the subquery's own
scope (silently wrong, or "ambiguous" when the subquery joins two tables with `id`). Queries with joins,
and all WHERE clauses, are always rendered `"table"."col"` and are unaffected. Fixed by writing the outer
column as plain text (`users.id`, `brokerages.id`) in the two single-table selects: `listUsers()` and the
brokerages block of `listAgentsAdmin()` (whose counts were silently always ~0). The other sites listed
previously (`listAgentsAdmin()` agent rows, `listListingsAdmin()`, `agents.ts`, `search/postgres.ts`,
`listReportsAdmin()`) are all joined queries or WHERE clauses and were checked via `.toSQL()` — no change
needed. Rule of thumb: in a join-less `.select({...})`, never interpolate a column inside a subquery.

## Phase 4 — Pro workspace ✅

- `/pro` shell (agents, brokers, property managers, admins); gated by `canUseProAccount()` when
  subscriptions are ON and free agent accounts are OFF
- Overview: live listings, 30-day views/leads, follow-ups due, upcoming tours, pipeline
- Listings: create/edit (geocodes the address, falls back to manual coordinates), draft → publish
  (honours "Require listing approval" and the `listings.active` limit), status changes with price-history
  events, featured toggle (`listings.featured`), photo upload/reorder/delete via `StorageProvider`
- AI listing writer: deterministic draft from facts (`src/lib/ai/listing-writer.ts`), optional model polish
  rejected if it introduces any number not in the facts (`src/lib/ai/grounding.ts`)
- Lead CRM (`crm.access`): pipeline board + list, stage changes with automatic follow-up dates
  (`src/lib/crm.ts`), notes/calls/tasks, email a lead through the platform, AI follow-up drafts
  (`ai.agent_assistant`), message leads who have an account
- Tours (`tours.scheduling`): agenda, confirm/cancel (requester notified), completed/no-show logged to the lead
- Messaging (`/messages`, all users): inbox, threads with polling refresh, unread badges, notifications
  that fire once per burst
- Analytics (`analytics.advanced`): per-listing views/saves/inquiries, daily trends, lead sources, conversion
- Billing: `/pricing` (plans by audience, monthly/annual), `/billing` (plan, usage meters, cancel/resume,
  payment history), `/billing/checkout` (mock provider: simulate success/decline). One trial per account;
  double-submitted checkouts don't create duplicate subscriptions

Not built (intentionally): renewal charging/dunning — the mock provider never moves money, so there is
nothing to renew. A real adapter would drive renewals via its webhooks.

## Phase 5 — Engagement ✅

- Saved-search alerts: `runSavedSearchAlerts()` (`src/server/jobs/alerts.ts`) with pure scheduling in
  `src/lib/alerts.ts` (instant/daily/weekly with jitter slack; the window always advances so a listing is
  announced once). Trigger with `POST /api/jobs/alerts` + `Authorization: Bearer $JOBS_SECRET` every
  10–15 min, or "Run now" in Admin → Notifications
- Collaborative boards: `/boards`, `/boards/[id]` (love/pass votes, comments, most-loved first),
  invite links (`/boards/join/[code]`, owners can reset), editor/viewer roles, "Board" button on every home,
  members notified of new homes and comments
- Personalized matching: `/for-you` merges explicit preferences (stored in `users.preferences.home`) over
  preferences inferred from saved homes (`src/lib/ai/personalize.ts`), ranked with the explainable
  Home Finder scoring
- Notification preferences: per type × channel (in-app / email) in `users.preferences.notifications`,
  enforced centrally in `notify()`; billing email can't be switched off. `/notifications` page with
  mark-all-read and a header bell with unread count
- Dark mode: token overrides under `:root[data-theme="dark"]` in `globals.css`, a pre-paint inline script
  (no flash; follows the OS on "System"), and a System → Light → Dark toggle in the site header and
  dashboard shells
