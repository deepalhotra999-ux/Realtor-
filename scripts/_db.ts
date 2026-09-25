import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/dwellwise";

export function connect() {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema, casing: "snake_case" });
  return { sql, db, close: () => sql.end() };
}
