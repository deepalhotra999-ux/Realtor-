/**
 * Server startup hook. On single-service free hosting (no separate worker
 * process), RUN_WORKER_IN_WEB=true runs the background job worker inside the
 * web server. Elsewhere, run `pnpm worker` as its own process instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RUN_WORKER_IN_WEB === "true") {
    await import("./instrumentation-node");
  }
}
