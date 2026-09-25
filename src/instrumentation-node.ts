import { runWorker } from "@/server/jobs/runner";

// register() must finish before the server accepts requests, so the worker
// loop is started without awaiting it. One loop per server process.
const g = globalThis as unknown as { __dwWorker?: boolean };
if (!g.__dwWorker) {
  g.__dwWorker = true;
  void runWorker({ pollMs: 5000, log: (m) => console.log(`[worker:web] ${m}`) }).catch((err) =>
    console.error("[worker:web] stopped:", err),
  );
}
