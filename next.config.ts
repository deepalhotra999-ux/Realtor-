import { existsSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";

/**
 * Netlify doesn't pass netlify.toml variables to server functions, so a
 * zero-config Netlify deploy bakes its defaults in here at build time
 * (read by src/lib/env.ts; real environment variables always win).
 * Only server code reads them — src/lib/env.ts is never imported by client code.
 */
function netlifyDefaults(): Record<string, string | undefined> {
  if (process.env.NETLIFY !== "true") return {};
  const generated = existsSync("netlify/generated.json")
    ? (JSON.parse(readFileSync("netlify/generated.json", "utf8")) as {
        authSecret?: string;
        jobsToken?: string;
      })
    : {};
  return {
    DEMO_MODE: process.env.DEMO_MODE ?? "true",
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER ?? "netlify-blobs",
    AI_PROVIDER: process.env.AI_PROVIDER ?? "mock",
    APP_URL: process.env.APP_URL ?? process.env.URL,
    AUTH_SECRET: process.env.AUTH_SECRET ?? generated.authSecret,
    JOBS_SECRET: process.env.JOBS_SECRET ?? generated.jobsToken,
  };
}

const nextConfig: NextConfig = {
  env: { DW_BUILD_DEFAULTS: JSON.stringify(netlifyDefaults()) },
  experimental: {
    serverActions: {
      // Listing photos upload through a Server Action (default limit is 1 MB).
      // Per-file (8 MB) and per-batch limits are enforced in the action and UI.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
