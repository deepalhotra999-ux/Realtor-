/**
 * Side-effect imports that register every job handler and schedule. Add new
 * automation modules here so the worker (and "Run now" in admin) sees them.
 */
import "./handlers";
import "@/server/trust/jobs";
