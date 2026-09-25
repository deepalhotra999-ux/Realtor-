import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { jobs, jobSchedules } from "@/server/db/schema";
import { errorText, retryDelayMs, shouldRetry } from "@/lib/jobs";

/**
 * Postgres-backed job queue. Workers claim jobs with FOR UPDATE SKIP LOCKED,
 * so any number of workers can run safely. Failed attempts are retried with
 * exponential backoff; after `maxAttempts` a job is marked `dead` for review.
 */

export type Job = typeof jobs.$inferSelect;

export interface EnqueueOptions {
  runAt?: Date;
  priority?: number;
  maxAttempts?: number;
  /** While a job with this key is queued/running, further enqueues are no-ops. */
  dedupeKey?: string;
}

export async function enqueue(
  type: string,
  payload: Record<string, unknown> = {},
  opts: EnqueueOptions = {},
): Promise<string | null> {
  const [row] = await getDb()
    .insert(jobs)
    .values({
      type,
      payload,
      runAt: opts.runAt ?? new Date(),
      priority: opts.priority ?? 0,
      maxAttempts: opts.maxAttempts ?? 5,
      dedupeKey: opts.dedupeKey ?? null,
    })
    .onConflictDoNothing({
      target: jobs.dedupeKey,
      where: sql`status in ('queued', 'running') and dedupe_key is not null`,
    })
    .returning({ id: jobs.id });
  return row?.id ?? null;
}

/** Atomically claim up to `limit` due jobs for this worker. */
export async function claimJobs(workerId: string, limit: number): Promise<Job[]> {
  const rows = await getDb().execute<{ id: string }>(sql`
    update jobs set status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    where id in (
      select id from jobs
      where status = 'queued' and run_at <= now()
      order by priority desc, run_at
      limit ${limit}
      for update skip locked
    )
    returning id`);
  const ids = [...rows].map((r) => r.id);
  if (!ids.length) return [];
  return getDb().select().from(jobs).where(inArray(jobs.id, ids));
}

export async function completeJob(id: string, result: Record<string, unknown> | void) {
  await getDb()
    .update(jobs)
    .set({
      status: "succeeded",
      result: result ?? null,
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    })
    .where(eq(jobs.id, id));
}

export async function failJob(job: Job, err: unknown) {
  const retry = shouldRetry(job.attempts, job.maxAttempts);
  await getDb()
    .update(jobs)
    .set(
      retry
        ? {
            status: "queued",
            runAt: new Date(Date.now() + retryDelayMs(job.attempts)),
            lastError: errorText(err),
            lockedAt: null,
            lockedBy: null,
          }
        : {
            status: "dead",
            lastError: errorText(err),
            finishedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
          },
    )
    .where(eq(jobs.id, job.id));
  return retry ? "retry" : "dead";
}

/** Return jobs whose worker died mid-run to the queue. */
export async function reapStaleJobs(staleAfterMs = 15 * 60_000) {
  const rows = await getDb()
    .update(jobs)
    .set({ status: "queued", lockedAt: null, lockedBy: null, lastError: "Worker lost; requeued" })
    .where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, new Date(Date.now() - staleAfterMs))))
    .returning({ id: jobs.id });
  return rows.length;
}

/**
 * Enqueue every due schedule exactly once, even with several workers: the
 * UPDATE takes a row lock, so a concurrent worker re-checks `next_run_at`
 * after the winner commits and skips it. The next run is anchored to the
 * previous due time (no drift) but never scheduled in the past (no bursts).
 */
export async function tickSchedules(): Promise<string[]> {
  const due = await getDb().execute<{
    name: string;
    job_type: string;
    payload: Record<string, unknown>;
  }>(sql`
    update job_schedules set
      last_run_at = now(),
      next_run_at = case
        when next_run_at + make_interval(secs => interval_seconds) > now()
          then next_run_at + make_interval(secs => interval_seconds)
        else now() + make_interval(secs => interval_seconds)
      end
    where enabled and next_run_at <= now()
    returning name, job_type, payload`);
  const fired: string[] = [];
  for (const s of due) {
    await enqueue(s.job_type, s.payload, { dedupeKey: `schedule:${s.name}` });
    fired.push(s.name);
  }
  return fired;
}

/** Run a schedule now (admin "Run now"); its regular cadence is unchanged. */
export async function runScheduleNow(name: string) {
  const [s] = await getDb().select().from(jobSchedules).where(eq(jobSchedules.name, name));
  if (!s) throw new Error(`Unknown schedule ${name}`);
  return enqueue(s.jobType, s.payload, { dedupeKey: `schedule:${s.name}`, priority: 5 });
}

export interface ScheduleDefinition {
  name: string;
  jobType: string;
  intervalSeconds: number;
  description: string;
  payload?: Record<string, unknown>;
}

/** Insert missing schedules; never overwrite admin changes to existing ones. */
export async function ensureSchedules(defs: ScheduleDefinition[]) {
  if (!defs.length) return;
  await getDb()
    .insert(jobSchedules)
    .values(
      defs.map((d) => ({
        name: d.name,
        jobType: d.jobType,
        intervalSeconds: d.intervalSeconds,
        description: d.description,
        payload: d.payload ?? {},
      })),
    )
    .onConflictDoNothing({ target: jobSchedules.name });
}

/** Delete finished jobs older than `days` so the table stays small. */
export async function pruneJobs(days = 14) {
  const rows = await getDb()
    .delete(jobs)
    .where(
      and(
        inArray(jobs.status, ["succeeded", "dead"]),
        lt(jobs.finishedAt, new Date(Date.now() - days * 86_400_000)),
      ),
    )
    .returning({ id: jobs.id });
  return rows.length;
}
