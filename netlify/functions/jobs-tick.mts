/**
 * Netlify Scheduled Function: drives Dwellwise's background jobs (saved-search
 * alerts, lifting timed penalties, verification expiry …) every 10 minutes by
 * calling the app's /api/jobs/tick endpoint. Scheduled functions run on
 * published production deploys only.
 *
 * The token comes from netlify/generated.json, written during the build by
 * scripts/netlify-prepare.mjs (or JOBS_SECRET if you set one in the UI).
 */
import generated from "../generated.json" with { type: "json" };

const handler = async () => {
  const base = process.env.URL;
  const token = process.env.JOBS_SECRET || generated.jobsToken;
  if (!base) return new Response("URL not available", { status: 500 });
  const res = await fetch(`${base}/api/jobs/tick`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  console.log(`[jobs-tick] ${res.status} ${body.slice(0, 500)}`);
  return new Response(body, { status: res.status });
};

export default handler;
export const config = { schedule: "*/10 * * * *" };
