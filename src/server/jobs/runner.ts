import "server-only";
import { hostname } from "node:os";
import { recordAudit, system } from "@/server/audit";
import { errorText } from "@/lib/jobs";
import { DEFAULT_SCHEDULES, getHandler } from "./handlers";
import "./register";
import { claimJobs, completeJob, ensureSchedules, failJob, tickSchedules, type Job } from "./queue";

const JOB_TIMEOUT_MS = 10 * 60_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

export async function runJob(job: Job): Promise<"succeeded" | "retry" | "dead"> {
  const handler = getHandler(job.type);
  try {
    if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
    const result = await withTimeout(Promise.resolve(handler(job.payload, job)), JOB_TIMEOUT_MS);
    await completeJob(job.id, result ?? undefined);
    return "succeeded";
  } catch (err) {
    const outcome = await failJob(job, err);
    console.error(
      `[worker] ${job.type} (${job.id}) attempt ${job.attempts} failed: ${errorText(err, 300)}`,
    );
    if (outcome === "dead")
      await recordAudit({
        actor: system("worker"),
        action: "job.dead",
        target: { type: "job", id: job.id },
        reason: errorText(err, 500),
        meta: { type: job.type, attempts: job.attempts },
      }).catch(() => {});
    return outcome;
  }
}

/** One scheduler tick + one batch of jobs. Returns what happened. */
export async function workOnce(workerId: string, batch = 5) {
  const scheduled = await tickSchedules();
  const claimed = await claimJobs(workerId, batch);
  const outcomes = await Promise.all(claimed.map((j) => runJob(j)));
  return { scheduled, ran: claimed.map((j, i) => ({ type: j.type, outcome: outcomes[i] })) };
}

export interface WorkerOptions {
  pollMs?: number;
  batch?: number;
  signal?: AbortSignal;
  log?: (msg: string) => void;
}

/** Long-running loop used by `pnpm worker`. Stops cleanly when `signal` aborts. */
export async function runWorker(opts: WorkerOptions = {}) {
  const workerId = `${hostname()}:${process.pid}`;
  const log = opts.log ?? ((m: string) => console.log(`[worker] ${m}`));
  await ensureSchedules(DEFAULT_SCHEDULES);
  log(`started as ${workerId} with ${DEFAULT_SCHEDULES.length} schedules`);
  while (!opts.signal?.aborted) {
    let busy = false;
    try {
      const { scheduled, ran } = await workOnce(workerId, opts.batch ?? 5);
      for (const s of scheduled) log(`scheduled ${s}`);
      for (const r of ran) log(`${r.type} → ${r.outcome}`);
      busy = ran.length > 0;
    } catch (err) {
      log(`loop error: ${errorText(err, 300)}`);
    }
    // Drain quickly while there's work; otherwise poll.
    if (!busy) await new Promise((r) => setTimeout(r, opts.pollMs ?? 2000));
  }
  log("stopped");
}
