# Architecture

Dwellwise is a single Next.js (App Router) application backed by PostgreSQL + PostGIS. It favours a
modular monolith: clear internal boundaries, one deployable.

```
Browser ──► Next.js (React Server Components, Server Actions, Route Handlers)
              │
              ├── src/app/…            routes: (site) marketplace, /pro workspace, /admin panel, /api
              ├── src/components/…     UI (server components by default, client islands where needed)
              ├── src/server/…         server-only domain services (auth, settings, entitlements, search, AI, notify)
              ├── src/providers/…      interfaces + free implementations for every external service
              └── src/lib/…            pure, framework-free logic (query model, entitlement engine, formatting)
              │
              ▼
        PostgreSQL 16 + PostGIS  (Drizzle ORM, SQL migrations in /drizzle)
```

## Layering rules

1. **`src/lib`** is pure TypeScript — no I/O, no framework imports. It holds the logic most worth testing
   (search query model, entitlement engine, feature flags, mortgage maths, NL query parser, formatting).
2. **`src/providers`** defines one interface per external capability plus free implementations. The only file
   that chooses implementations is `src/providers/index.ts`.
3. **`src/server`** contains server-only services (`import "server-only"`) that combine the database,
   settings and providers: auth/sessions, settings cache, entitlements, notifications, search, AI features.
4. **`src/app`** routes stay thin: they authorize, call services, and render.

## Rendering & data access

- Pages that read the database are dynamic (they read cookies or call `connection()`), so `next build` never
  needs a database.
- Mutations are Server Actions that re-check authorization server-side; the `proxy` only does optimistic
  redirects.
- Settings and feature flags are cached in-process for 5 seconds and invalidated on write.

## Data model (high level)

| Area           | Tables                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Identity       | `users`, `sessions`, `brokerages`, `agent_profiles`                                                      |
| Inventory      | `properties` (PostGIS `geometry(Point,4326)`), `listings`, `property_media`, `price_history`             |
| Consumer       | `favorites`, `saved_searches`, `boards`, `board_members`, `board_items`, `board_votes`, `board_comments` |
| CRM & comms    | `leads`, `lead_activities`, `conversations`, `conversation_participants`, `messages`, `tours`            |
| Trust & safety | `reviews`, `reports`, `audit_logs`                                                                       |
| Configuration  | `app_settings` (zod-validated JSON sections), `feature_flags`                                            |
| Monetisation   | `features`, `plans`, `plan_entitlements`, `subscriptions`, `payments`, `usage_counters`                  |
| Messaging/ops  | `notifications`, `outbound_messages` (email/SMS outbox), `ai_requests`, `events`                         |

A **property** is the physical asset; a **listing** is a time-bound offer (sale or rent) of it. Imports upsert on
`(source, external_id)` so MLS re-syncs update rather than duplicate.

### Search

`PostgresSearchProvider` combines:

- `listings.search_vector` — a generated `tsvector` column with a GIN index for full-text queries,
- `properties.location` — a PostGIS point with a GiST index for bounding-box (`&&`) and radius (`ST_DWithin`)
  queries from the map,
- ordinary B-tree indexes for price/status/type filters.

The canonical `SearchQuery` (`src/lib/search/query.ts`) is shared by the URL, saved searches, the AI natural
language parser and every search provider.

## Auth

Built-in, dependency-free session auth: scrypt password hashes, random 256-bit session tokens in an httpOnly
cookie, only the SHA-256 of the token stored server-side, sliding expiry. Roles: `consumer`, `agent`, `broker`,
`property_manager`, `admin`. Guards: `requireUser`, `requirePro`, `requireAdmin`.

## Demo media

Fictional listings use deterministic SVG illustrations rendered by `/demo-media/[type]/[seed]/[scene]` — original
artwork, generated offline. Real listings upload photos through the `StorageProvider`.
