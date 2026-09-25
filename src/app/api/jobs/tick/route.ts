import { timingSafeEqual } from "node:crypto";
import { hostname } from "node:os";
import { NextResponse, type NextRequest } from "next/server";
import { ensureSchedules } from "@/server/jobs/queue";
import { DEFAULT_SCHEDULES } from "@/server/jobs/handlers";
import { workOnce } from "@/server/jobs/runner";
import { getEnv } from "@/lib/env";

/**
 * Drives background jobs on serverless hosts with no long-running worker
 * (Netlify: netlify/functions/jobs-tick.mts calls this every 10 minutes).
 *   curl -X POST -H "Authorization: Bearer $JOBS_SECRET" $APP_URL/api/jobs/tick
 * Runs due schedules and queued jobs within a time budget that fits the
 * host's function timeout; anything left waits for the next tick.
 */
const BUDGET_MS = 8000;

function authorized(req: NextRequest) {
  const env = getEnv();
  if (!env.JOBS_SECRET) return env.NODE_ENV === "development";
  const expected = Buffer.from(`Bearer ${env.JOBS_SECRET}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const started = Date.now();
  await ensureSchedules(DEFAULT_SCHEDULES);
  const workerId = `tick:${hostname()}:${process.pid}`;
  const scheduled: string[] = [];
  const ran: { type: string; outcome: string }[] = [];
  do {
    const r = await workOnce(workerId, 3);
    scheduled.push(...r.scheduled);
    ran.push(...r.ran);
    if (r.ran.length === 0) break;
  } while (Date.now() - started < BUDGET_MS);
  return NextResponse.json({ scheduled, ran, ms: Date.now() - started });
}
