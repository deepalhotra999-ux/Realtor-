import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integration tests against a real, migrated Postgres (DATABASE_URL, default
 * postgres://postgres:postgres@localhost:5432/dwellwise). Run: pnpm test:int
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts"],
    // Suites share one database; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
