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

## Phase 2 — Marketplace

Home page, map + list split search with filters, property detail, favorites, compare, mortgage calculator,
agent directory & profiles, market insights, AI home finder / NL search / property Q&A.

## Phase 3 — Admin panel

Users, agents, brokers, listings, leads, reviews, reports, AI, notifications outbox, feature flags, analytics,
settings, plans/features/entitlements, subscriptions & trials.

## Phase 4 — Pro workspace

Listing management (with AI description writer), lead CRM pipeline, messaging, tour scheduling, analytics,
billing through the PaymentProvider.

## Phase 5 — Engagement

Saved-search alerts job, collaborative boards, personalized matching, notification preferences, dark mode.
