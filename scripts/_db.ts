import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";

/**
 * Scripts (migrate, seed) prefer a direct connection: Netlify DB / Neon
 * expose an unpooled URL for exactly this.
 */
export const DATABASE_URL =
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/dwellwise";

export function connect() {
  const sql = postgres(DATABASE_URL, {
    max: 1,
    onnotice: () => {},
    prepare: !DATABASE_URL.includes("-pooler"),
  });
  const db = drizzle(sql, { schema, casing: "snake_case" });
  return { sql, db, close: () => sql.end() };
}
