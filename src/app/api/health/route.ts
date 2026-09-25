import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { describeProviders } from "@/providers";

/** Liveness + dependency report. Never exposes secrets. */
export async function GET() {
  const started = performance.now();
  let database: { ok: boolean; postgis?: string; error?: string };
  try {
    const [row] = await getDb().execute<{ v: string }>(sql`select postgis_lib_version() as v`);
    database = { ok: true, postgis: row?.v };
  } catch (err) {
    database = { ok: false, error: (err as Error).message.split("\n")[0] };
  }
  const providers = await describeProviders();
  return Response.json(
    {
      status: database.ok ? "ok" : "degraded",
      database,
      providers,
      latencyMs: Math.round(performance.now() - started),
    },
    { status: database.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
