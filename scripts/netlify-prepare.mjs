/**
 * Netlify build step (runs before `next build`, see netlify.toml).
 *
 * Generates per-deploy secrets so the demo needs zero manual configuration:
 * AUTH_SECRET (HMAC for codes/checkout sessions) and a jobs token shared by
 * the Next.js app and the scheduled function that drives background jobs.
 * Values you set in the Netlify UI always take precedence.
 * Written to netlify/generated.json (git-ignored); never shipped to browsers.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const secret = () => randomBytes(32).toString("base64url");
mkdirSync("netlify", { recursive: true });
writeFileSync(
  "netlify/generated.json",
  JSON.stringify({
    authSecret: process.env.AUTH_SECRET || secret(),
    jobsToken: process.env.JOBS_SECRET || secret(),
  }),
);
console.log("› netlify/generated.json written (per-deploy secrets)");
