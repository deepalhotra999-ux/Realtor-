@AGENTS.md

# Dwellwise — project notes

- Zero paid APIs: every external service goes through an interface in `src/providers/*/types.ts`; only
  `src/providers/index.ts` picks implementations. Keep the free/local option the default.
- Layering: `src/lib` is pure (no I/O) and holds the logic we unit-test; `src/server` is server-only services;
  `src/app` routes stay thin.
- Never invent property facts in AI features — ground in DB facts, validate structured output with zod.
- Schema changes: edit `src/server/db/schema.ts`, run `pnpm db:generate`, review the SQL
  (drizzle-kit drops the PostGIS SRID — keep `geometry(point, 4326)`), then `pnpm db:migrate`.
- Before committing: `pnpm check` (typecheck → lint → test → build).
- Seed data is fictional; label it as such in UI.
