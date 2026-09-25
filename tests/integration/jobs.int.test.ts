import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { getDb } from "@/server/db";
import { auditLogs, jobSchedules, jobs } from "@/server/db/schema";
import { claimJobs, enqueue, failJob, reapStaleJobs, tickSchedules } from "@/server/jobs/queue";
import { registerHandler } from "@/server/jobs/handlers";
import { runJob } from "@/server/jobs/runner";
import { recordAudit } from "@/server/audit";

const T = "test.";

async function cleanup() {
  const db = getDb();
  await db.delete(jobs).where(like(jobs.type, `${T}%`));
  await db.delete(jobSchedules).where(like(jobSchedules.name, `${T}%`));
  await db.delete(auditLogs).where(like(auditLogs.action, `${T}%`));
}

/** Park real (non-test) queued jobs so claims in these tests only see test jobs. */
async function claimOnlyTests(worker: string, n: number) {
  const claimed = await claimJobs(worker, n);
  const foreign = claimed.filter((j) => !j.type.startsWith(T));
  for (const j of foreign)
    await getDb()
      .update(jobs)
      .set({ status: "queued", attempts: j.attempts - 1, lockedAt: null, lockedBy: null })
      .where(eq(jobs.id, j.id));
  return claimed.filter((j) => j.type.startsWith(T));
}

beforeEach(cleanup);
afterAll(cleanup);

describe("job queue (Postgres)", () => {
  it("dedupes while a job with the same key is pending", async () => {
    const a = await enqueue(`${T}dedupe`, {}, { dedupeKey: "test:k1" });
    const b = await enqueue(`${T}dedupe`, {}, { dedupeKey: "test:k1" });
    expect(a).toBeTruthy();
    expect(b).toBeNull();
  });

  it("never hands the same job to two concurrent workers", async () => {
    for (let i = 0; i < 12; i++) await enqueue(`${T}claim`, { i });
    const [a, b, c] = await Promise.all([
      claimOnlyTests("w-a", 12),
      claimOnlyTests("w-b", 12),
      claimOnlyTests("w-c", 12),
    ]);
    const ids = [...a, ...b, ...c].map((j) => j.id);
    expect(ids.length).toBe(12);
    expect(new Set(ids).size).toBe(12);
  });

  it("retries with backoff, then marks the job dead", async () => {
    await enqueue(`${T}flaky`, {}, { maxAttempts: 2 });
    let [job] = await claimOnlyTests("w", 5);
    expect(await failJob(job, new Error("first"))).toBe("retry");
    const [afterFirst] = await getDb().select().from(jobs).where(eq(jobs.id, job.id));
    expect(afterFirst.status).toBe("queued");
    expect(afterFirst.runAt.getTime()).toBeGreaterThan(Date.now() + 20_000);

    await getDb().update(jobs).set({ runAt: new Date() }).where(eq(jobs.id, job.id));
    [job] = await claimOnlyTests("w", 5);
    expect(job.attempts).toBe(2);
    expect(await failJob(job, new Error("second"))).toBe("dead");
    const [dead] = await getDb().select().from(jobs).where(eq(jobs.id, job.id));
    expect(dead.status).toBe("dead");
    expect(dead.lastError).toContain("second");
  });

  it("runs registered handlers and stores their result; unknown types fail", async () => {
    registerHandler(`${T}echo`, async (payload) => ({ echoed: payload.value }));
    await enqueue(`${T}echo`, { value: 42 });
    await enqueue(`${T}nohandler`, {}, { maxAttempts: 1 });
    const claimed = await claimOnlyTests("w", 5);
    const outcomes = Object.fromEntries(
      await Promise.all(claimed.map(async (j) => [j.type, await runJob(j)] as const)),
    );
    expect(outcomes[`${T}echo`]).toBe("succeeded");
    expect(outcomes[`${T}nohandler`]).toBe("dead");
    const [echo] = await getDb()
      .select()
      .from(jobs)
      .where(eq(jobs.type, `${T}echo`));
    expect(echo.result).toEqual({ echoed: 42 });
  });

  it("requeues jobs abandoned by a crashed worker", async () => {
    await enqueue(`${T}stale`);
    const [job] = await claimOnlyTests("dead-worker", 5);
    await getDb()
      .update(jobs)
      .set({ lockedAt: new Date(Date.now() - 60 * 60_000) })
      .where(eq(jobs.id, job.id));
    expect(await reapStaleJobs()).toBeGreaterThanOrEqual(1);
    const [row] = await getDb().select().from(jobs).where(eq(jobs.id, job.id));
    expect(row.status).toBe("queued");
  });

  it("fires a due schedule exactly once across concurrent workers", async () => {
    const past = new Date(Date.now() - 1000);
    await getDb()
      .insert(jobSchedules)
      .values({
        name: `${T}sched`,
        jobType: `${T}scheduled`,
        intervalSeconds: 300,
        nextRunAt: past,
      });
    const fired = (await Promise.all([tickSchedules(), tickSchedules(), tickSchedules()])).flat();
    expect(fired.filter((n) => n === `${T}sched`)).toHaveLength(1);
    const queued = await getDb()
      .select()
      .from(jobs)
      .where(eq(jobs.type, `${T}scheduled`));
    expect(queued).toHaveLength(1);
    const [s] = await getDb()
      .select()
      .from(jobSchedules)
      .where(eq(jobSchedules.name, `${T}sched`));
    expect(s.nextRunAt.getTime()).toBeGreaterThan(Date.now() + 200_000);
    expect(await tickSchedules()).not.toContain(`${T}sched`);
  });
});

describe("audit log service (Postgres)", () => {
  it("records SYSTEM actions with the rule name and a before/after diff", async () => {
    await recordAudit({
      actor: { type: "system", rule: "test-rule" },
      action: `${T}listing.hide`,
      target: { type: "listing", id: "abc" },
      reason: "risk score 91",
      before: { status: "active", title: "x" },
      after: { status: "suspended", title: "x" },
    });
    const [row] = await getDb()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, `${T}listing.hide`), eq(auditLogs.targetId, "abc")));
    expect(row.actorType).toBe("system");
    expect(row.actorLabel).toBe("test-rule");
    expect(row.actorId).toBeNull();
    expect(row.reason).toBe("risk score 91");
    expect(row.before).toEqual({ status: "active" });
    expect(row.after).toEqual({ status: "suspended" });
  });
});
