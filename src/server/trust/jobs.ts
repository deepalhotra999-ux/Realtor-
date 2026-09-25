import "server-only";
import { getSettings } from "@/server/settings";
import { registerHandler, registerSchedule } from "@/server/jobs/handlers";
import { expireEnforcements } from "./enforcement";
import { expireVerifications, recomputeVerificationLevel } from "./verification";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";

/** Trust & safety automation run by the worker (see Admin → Background jobs). */

registerHandler("trust.expire_enforcement", async () => {
  if (!(await getSettings("automation")).accountEnforcement)
    return { skipped: "account enforcement automation is off" };
  return expireEnforcements();
});
registerSchedule({
  name: "lift-expired-penalties",
  jobType: "trust.expire_enforcement",
  intervalSeconds: 300,
  description: "Restore access when timed warnings, suspensions and restrictions end.",
});

/** Queued (not scheduled) when a setting that affects levels changes. */
registerHandler("trust.recompute_levels", async () => {
  const rows = await getDb().select({ id: users.id }).from(users);
  let changed = 0;
  for (const u of rows) {
    const [before] = await getDb()
      .select({ l: users.verificationLevel })
      .from(users)
      .where(eq(users.id, u.id));
    if ((await recomputeVerificationLevel(u.id)) !== before.l) changed++;
  }
  return { users: rows.length, changed };
});

registerHandler("trust.expire_verifications", async () => {
  if (!(await getSettings("automation")).verificationRequirements)
    return { skipped: "verification automation is off" };
  return expireVerifications();
});
registerSchedule({
  name: "verification-maintenance",
  jobType: "trust.expire_verifications",
  intervalSeconds: 3600,
  description: "Expire lapsed identity/license checks and delete documents past retention.",
});
