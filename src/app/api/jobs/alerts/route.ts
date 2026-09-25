import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runSavedSearchAlerts } from "@/server/jobs/alerts";
import { getEnv } from "@/lib/env";

/**
 * Cron entry point for saved-search alerts:
 *   curl -X POST -H "Authorization: Bearer $JOBS_SECRET" $APP_URL/api/jobs/alerts
 * Run it every 10–15 minutes; each search is only processed when due.
 */
function authorized(req: NextRequest) {
  const env = getEnv();
  if (!env.JOBS_SECRET) return env.NODE_ENV === "development";
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${env.JOBS_SECRET}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runSavedSearchAlerts();
  return NextResponse.json(result);
}
