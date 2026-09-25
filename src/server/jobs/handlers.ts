import "server-only";
import { lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { runSavedSearchAlerts } from "./alerts";
import { pruneJobs, reapStaleJobs, type Job, type ScheduleDefinition } from "./queue";

/**
 * Job handlers, keyed by job type. A handler returns a small JSON summary
 * (stored on the job row) or throws to trigger a retry. Handlers must be
 * idempotent: a job can run more than once after a crash or retry.
 */
export type JobHandler = (
  payload: Record<string, unknown>,
  job: Job,
) => Promise<Record<string, unknown> | void>;

const HANDLERS: Record<string, JobHandler> = {};

export function registerHandler(type: string, handler: JobHandler) {
  HANDLERS[type] = handler;
}

export function getHandler(type: string): JobHandler | undefined {
  return HANDLERS[type];
}

export function handlerTypes() {
  return Object.keys(HANDLERS).sort();
}

/** Schedules the worker keeps in `job_schedules` (admins can pause or retime them). */
export const DEFAULT_SCHEDULES: ScheduleDefinition[] = [];

export function registerSchedule(def: ScheduleDefinition) {
  if (!DEFAULT_SCHEDULES.some((s) => s.name === def.name)) DEFAULT_SCHEDULES.push(def);
}

/* ── Core handlers ────────────────────────────────────────────────────────── */

registerHandler("alerts.saved_searches", async () => {
  const automation = await getSettings("automation");
  if (!automation.savedSearchAlerts) return { skipped: "disabled in Automation & Trust" };
  return { ...(await runSavedSearchAlerts()) };
});
registerSchedule({
  name: "saved-search-alerts",
  jobType: "alerts.saved_searches",
  intervalSeconds: 600,
  description: "Email/notify users about new homes matching their saved searches.",
});

registerHandler("maintenance.purge_sessions", async () => {
  const rows = await getDb()
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return { purged: rows.length };
});
registerSchedule({
  name: "purge-expired-sessions",
  jobType: "maintenance.purge_sessions",
  intervalSeconds: 3600,
  description: "Delete expired login sessions.",
});

registerHandler("maintenance.jobs", async () => {
  const [requeued, pruned] = await Promise.all([reapStaleJobs(), pruneJobs(14)]);
  return { requeued, pruned };
});
registerSchedule({
  name: "job-maintenance",
  jobType: "maintenance.jobs",
  intervalSeconds: 900,
  description: "Requeue jobs from crashed workers and prune finished jobs older than 14 days.",
});
