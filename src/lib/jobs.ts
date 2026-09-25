/** Pure job-queue maths shared by the queue, the worker and tests. */

/** Exponential backoff with a cap: 30s, 1m, 2m, 4m … up to 1h. Deterministic. */
export function retryDelayMs(attempt: number, baseMs = 30_000, capMs = 3_600_000): number {
  return Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
}

/** Whether a failed attempt should be retried or the job declared dead. */
export function shouldRetry(attempts: number, maxAttempts: number): boolean {
  return attempts < maxAttempts;
}

/** Truncate error text stored on a job row. */
export function errorText(err: unknown, max = 2000): string {
  const e = err as { stack?: string; message?: string };
  return String(e?.stack ?? e?.message ?? err).slice(0, max);
}
