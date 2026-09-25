import { z } from "zod";

/**
 * Server environment. Every variable has a free/local default so the platform
 * boots with no configuration and no paid API keys.
 */
const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/dwellwise"),
  APP_URL: z.string().default("http://localhost:3000"),
  AUTH_SECRET: z.string().default("dev-insecure-secret-change-me"),

  AI_PROVIDER: z.enum(["auto", "ollama", "mock"]).default("auto"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2"),
  OLLAMA_EMBED_MODEL: z.string().default("nomic-embed-text"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  MAP_TILE_URL: z.string().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  MAP_TILE_ATTRIBUTION: z.string().default("&copy; OpenStreetMap contributors"),
  GEOCODING_PROVIDER: z.enum(["local", "nominatim"]).default("local"),
  NOMINATIM_URL: z.string().default("https://nominatim.openstreetmap.org"),
  NOMINATIM_USER_AGENT: z.string().default("Dwellwise/0.1 (self-hosted)"),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage/uploads"),
  S3_ENDPOINT: z.string().default("localhost"),
  S3_PORT: z.coerce.number().int().default(9000),
  S3_USE_SSL: bool.default(false),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_BUCKET: z.string().default("dwellwise"),
  S3_PUBLIC_URL: z.string().default("http://localhost:9000/dwellwise"),

  EMAIL_PROVIDER: z.enum(["outbox", "smtp"]).default("outbox"),
  EMAIL_FROM: z.string().default("Dwellwise <no-reply@dwellwise.local>"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMS_PROVIDER: z.enum(["outbox"]).default("outbox"),

  SEARCH_PROVIDER: z.enum(["postgres"]).default("postgres"),

  PROPERTY_DATA_PROVIDER: z.enum(["seed", "reso"]).default("seed"),
  RESO_BASE_URL: z.string().optional(),
  RESO_ACCESS_TOKEN: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(["mock"]).default("mock"),

  /** Bearer token for /api/jobs/* (cron). Unset = job endpoints disabled outside development. */
  JOBS_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof envSchema>;

function emptyToUndefined(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(source)) out[k] = v === "" ? undefined : v;
  return out;
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    const source = emptyToUndefined(process.env);
    // On Netlify, the managed Postgres (Netlify Database) is exposed as NETLIFY_DB_URL.
    source.DATABASE_URL ??= source.NETLIFY_DB_URL;
    const parsed = envSchema.safeParse(source);
    if (!parsed.success) {
      throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
    if (cached.NODE_ENV === "production" && cached.AUTH_SECRET.startsWith("dev-insecure")) {
      console.warn("[env] AUTH_SECRET is not set — set a strong secret before deploying.");
    }
  }
  return cached;
}

/** For tests only. */
export function resetEnvCache() {
  cached = undefined;
}
