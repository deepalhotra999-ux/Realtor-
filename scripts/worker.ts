/**
 * Background worker: runs scheduled automation and queued jobs until stopped.
 *
 *   pnpm worker
 *
 * Runs outside Next.js, so it's started with the `react-server` export
 * condition (making `server-only` imports no-ops) and `.env` loaded by Node.
 * Safe to run several copies: jobs are claimed with FOR UPDATE SKIP LOCKED.
 */
import { runWorker } from "../src/server/jobs/runner";

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    console.log(`[worker] ${sig} received, finishing current batch…`);
    controller.abort();
  });

runWorker({ signal: controller.signal })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
