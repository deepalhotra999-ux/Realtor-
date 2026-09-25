import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __dwDb?: Database; __dwSql?: postgres.Sql };

function create(): Database {
  const sql = postgres(getEnv().DATABASE_URL, { max: 10, prepare: true });
  globalForDb.__dwSql = sql;
  return drizzle(sql, { schema, casing: "snake_case" });
}

/** Lazily created so builds and tests never open a connection unless a query runs. */
export function getDb(): Database {
  if (!globalForDb.__dwDb) globalForDb.__dwDb = create();
  return globalForDb.__dwDb;
}

export { schema };
