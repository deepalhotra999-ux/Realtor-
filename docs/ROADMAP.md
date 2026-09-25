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

## Phase 3 — Admin panel (in progress)

Done: shell/nav (`src/components/admin/shell.tsx`), overview dashboard (`/admin`), users (`/admin/users`),
agents/brokerages (`/admin/agents`), listings (`/admin/listings`), leads (`/admin/leads`), reviews
moderation (`/admin/reviews`), trust & safety reports (`/admin/reports`), audit log (`/admin/audit`), the
`proxy.ts` optimistic auth redirect for `/admin`, `/pro`, etc., a "Report listing" user-facing action feeding
the reports queue, and server actions for all of the above (role/status changes, listing status/featured,
review/report moderation) in `src/server/actions/admin.ts`. Settings/plans/flags **forms** are written in
`src/components/admin/forms.tsx` (GeneralSettingsForm, MonetizationForm, AISettingsForm, AIPlayground,
TestEmailForm, FlagForm, PlanForm, FeatureForm, GrantPlanForm) but their **pages are not wired up yet**.

**Known bug found and partially fixed:** several correlated subqueries in `src/server/admin/queries.ts`
interpolate `${table.column}` (a Drizzle column reference) *inside* a nested `sql` template that has its
own subquery FROM clause (e.g. `... from listings l where l.agent_id = ${users.id}`). Postgres reported
"column reference is ambiguous" because the outer table's column isn't table-qualified in that position —
it renders as bare `"id"` which collides with a same-named column in the subquery's own scope. This broke
`/admin/users` (500 error). **Fix applied:** in `listUsers()`, replaced `${users.id}` with plain `users.id`
text in the `listings` and `plan` subqueries (valid because `users` is the outer query's real, unaliased
table name). **Still needs the same fix** (same replace-with-plain-text pattern) in, at minimum:
- `listAgentsAdmin()` — the `activeListings` / `leads30` subqueries (`${users.id}`)
- `listAgentsAdmin()`'s brokerages block — `agents` / `listings` subqueries (`${brokerages.id}`)
- `listListingsAdmin()` — the `photo` subquery (`${properties.id}`)
- `src/server/agents.ts` — `activeListings` (`${users.id}`) and the `f.city` `exists (...)` subquery
  (`${users.id}` inside `and (... where l.agent_id = ${users.id} ...)`)

Worth a careful re-check even though they haven't errored yet (same shape, may just not have hit the
colliding-name case in testing): `src/server/search/postgres.ts` (`photoUrl`, `photoCount`, `priceCut`
subqueries using `${properties.id}` / `${listings.id}` / `${listings.price}`), and
`listReportsAdmin()`'s `${listings.id}::text in (...)` (different pattern — an IN-list, not a correlated
subquery — lower risk but worth a test pass with real report rows against listings).

**Next up after that fix:** wire the existing forms into pages — `/admin/settings` (General +
Monetization + AI tabs), `/admin/plans` (plans/features/entitlements, using `PlanForm`/`FeatureForm`),
`/admin/subscriptions` (using `GrantPlanForm`, `cancelSubscriptionAdminAction`, `extendTrialAction` —
actions already exist in `server/actions/admin.ts`), `/admin/flags` (using `FlagForm`), `/admin/ai`
(using `AIPlayground`, `TestEmailForm`, plus `getAIStats()` which is already written in
`server/admin/queries.ts`), `/admin/notifications` (using `listOutbound()`, already written), and
`/admin/analytics` (using `getAnalytics()`, already written).

## Phase 4 — Pro workspace

Listing management (with AI description writer), lead CRM pipeline, messaging, tour scheduling, analytics,
billing through the PaymentProvider.

## Phase 5 — Engagement

Saved-search alerts job, collaborative boards, personalized matching, notification preferences, dark mode.
