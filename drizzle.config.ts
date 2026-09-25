import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/dwellwise",
  },
  // PostGIS owns its own tables (spatial_ref_sys etc.) — never let drizzle-kit touch them.
  extensionsFilters: ["postgis"],
  strict: true,
  verbose: true,
});
