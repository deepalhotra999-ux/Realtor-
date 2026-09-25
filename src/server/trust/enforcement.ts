import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accountRestrictions, sessions, strikes, users } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { recordAudit, type AuditActor } from "@/server/audit";
import { notify } from "@/server/notify";
import type { RestrictableFeature } from "@/lib/settings-schema";
import { FEATURE_LABELS, isBlocked, strikeStep, type AccountStatus } from "@/lib/trust";

/**
 * AccountEnforcementService. Every change records who made it (admin, user or
 * automation rule) and why. Timed penalties lapse automatically via
 * `expireEnforcements()` in the worker; admins can override any of it.
 */

export class AccountRestrictedError extends Error {
  constructor(
    message: string,
    readonly feature: RestrictableFeature | "account",
  ) {
    super(message);
    this.name = "AccountRestrictedError";
  }
}

const activeRestriction = (now = new Date()) =>
  and(
    isNull(accountRestrictions.liftedAt),
    lte(accountRestrictions.startsAt, now),
    or(isNull(accountRestrictions.endsAt), gt(accountRestrictions.endsAt, now)),
  );

async function userState(userId: string) {
  const [u] = await getDb()
    .select({
      id: users.id,
      status: users.status,
      statusUntil: users.statusUntil,
      statusReason: users.statusReason,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) throw new Error("User not found.");
  return u;
}

export async function activeRestrictions(userId: string) {
  return getDb()
    .select()
    .from(accountRestrictions)
    .where(and(eq(accountRestrictions.userId, userId), activeRestriction()))
    .orderBy(desc(accountRestrictions.createdAt));
}

const until = (d: Date | null) => (d ? ` until ${d.toLocaleDateString("en-US")}` : "");

/** Throws AccountRestrictedError unless the user may use `feature` right now. */
export async function assertFeatureAllowed(userId: string, feature: RestrictableFeature) {
  const u = await userState(userId);
  if (isBlocked(u.status as AccountStatus))
    throw new AccountRestrictedError(
      `Your account is ${u.status}${until(u.statusUntil)}.`,
      "account",
    );
  const [r] = await getDb()
    .select({ endsAt: accountRestrictions.endsAt, reason: accountRestrictions.reason })
    .from(accountRestrictions)
    .where(
      and(
        eq(accountRestrictions.userId, userId),
        eq(accountRestrictions.feature, feature),
        activeRestriction(),
      ),
    )
    .limit(1);
  if (r)
    throw new AccountRestrictedError(
      `Your account is restricted from ${FEATURE_LABELS[feature]}${until(r.endsAt)}. Reason: ${r.reason}`,
      feature,
    );
}

export async function isFeatureAllowed(userId: string, feature: RestrictableFeature) {
  try {
    await assertFeatureAllowed(userId, feature);
    return true;
  } catch (err) {
    if (err instanceof AccountRestrictedError) return false;
    throw err;
  }
}

/** Status to fall back to once penalties clear: restricted if any restriction remains. */
async function baseStatus(userId: string): Promise<AccountStatus> {
  return (await activeRestrictions(userId)).length ? "restricted" : "active";
}

async function setStatus(
  userId: string,
  next: { status: AccountStatus; statusUntil: Date | null; statusReason: string | null },
  actor: AuditActor,
  action: string,
  reason: string | null,
) {
  const before = await userState(userId);
  await getDb().update(users).set(next).where(eq(users.id, userId));
  if (isBlocked(next.status)) await getDb().delete(sessions).where(eq(sessions.userId, userId));
  await recordAudit({
    actor,
    action,
    target: { type: "user", id: userId },
    reason,
    before: { status: before.status, statusUntil: before.statusUntil },
    after: { status: next.status, statusUntil: next.statusUntil },
  });
}

const daysFromNow = (days: number | null | undefined) =>
  days ? new Date(Date.now() + days * 86_400_000) : null;

export async function warnUser(userId: string, reason: string, actor: AuditActor, days = 30) {
  const u = await userState(userId);
  // A warning never downgrades a harsher state.
  if (u.status === "active" || u.status === "warned")
    await setStatus(
      userId,
      { status: "warned", statusUntil: daysFromNow(days), statusReason: reason },
      actor,
      "user.warn",
      reason,
    );
  else
    await recordAudit({ actor, action: "user.warn", target: { type: "user", id: userId }, reason });
  await notify(
    userId,
    {
      type: "account",
      title: "A warning was added to your account",
      body: `${reason}\n\nRepeated issues can lead to restrictions.`,
      link: "/account/verification",
    },
    { email: true },
  );
}

export async function restrictUser(
  userId: string,
  features: RestrictableFeature[],
  reason: string,
  actor: AuditActor,
  days: number | null = null,
) {
  if (!features.length) throw new Error("Choose at least one feature to restrict.");
  const endsAt = daysFromNow(days);
  const db = getDb();
  await db.insert(accountRestrictions).values(
    features.map((feature) => ({
      userId,
      feature,
      reason,
      endsAt,
      createdById: actor.type === "admin" ? actor.id : null,
      source: actor.type === "system" ? actor.rule : null,
    })),
  );
  const u = await userState(userId);
  if (u.status === "active" || u.status === "warned")
    await setStatus(
      userId,
      { status: "restricted", statusUntil: null, statusReason: reason },
      actor,
      "user.restrict",
      reason,
    );
  else
    await recordAudit({
      actor,
      action: "user.restrict",
      target: { type: "user", id: userId },
      reason,
      meta: { features, endsAt },
    });
  await notify(
    userId,
    {
      type: "account",
      title: "Some features on your account are restricted",
      body: `Restricted: ${features.map((f) => FEATURE_LABELS[f]).join(", ")}${until(endsAt)}.\nReason: ${reason}`,
      link: "/account/verification",
    },
    { email: true },
  );
}

export async function suspendUser(
  userId: string,
  reason: string,
  actor: AuditActor,
  days: number | null = null,
) {
  const statusUntil = daysFromNow(days);
  await setStatus(
    userId,
    { status: "suspended", statusUntil, statusReason: reason },
    actor,
    "user.suspend",
    reason,
  );
  await notify(
    userId,
    {
      type: "account",
      title: "Your account has been suspended",
      body: `Suspended${until(statusUntil)}.\nReason: ${reason}`,
    },
    { email: true },
  );
}

export async function banUser(userId: string, reason: string, actor: AuditActor) {
  await setStatus(
    userId,
    { status: "banned", statusUntil: null, statusReason: reason },
    actor,
    "user.ban",
    reason,
  );
  await notify(
    userId,
    {
      type: "account",
      title: "Your account has been closed",
      body: `Reason: ${reason}\n\nContact support if you believe this is a mistake.`,
    },
    { email: true },
  );
}

/** Admin override: restore full access (lifts every active restriction). */
export async function reinstateUser(userId: string, reason: string, actor: AuditActor) {
  const db = getDb();
  await db
    .update(accountRestrictions)
    .set({ liftedAt: new Date(), liftedById: actor.type === "admin" ? actor.id : null })
    .where(and(eq(accountRestrictions.userId, userId), activeRestriction()));
  await setStatus(
    userId,
    { status: "active", statusUntil: null, statusReason: null },
    actor,
    "user.reinstate",
    reason,
  );
  await notify(
    userId,
    { type: "account", title: "Your account access has been restored", body: reason },
    { email: true },
  );
}

export async function liftRestriction(
  restrictionId: string,
  actor: AuditActor,
  reason = "Lifted by admin",
) {
  const db = getDb();
  const [r] = await db
    .update(accountRestrictions)
    .set({ liftedAt: new Date(), liftedById: actor.type === "admin" ? actor.id : null })
    .where(and(eq(accountRestrictions.id, restrictionId), isNull(accountRestrictions.liftedAt)))
    .returning();
  if (!r) return;
  await recordAudit({
    actor,
    action: "user.restriction_lifted",
    target: { type: "user", id: r.userId },
    reason,
    meta: { feature: r.feature, restrictionId },
  });
  const u = await userState(r.userId);
  if (u.status === "restricted" && (await baseStatus(r.userId)) === "active")
    await setStatus(
      r.userId,
      { status: "active", statusUntil: null, statusReason: null },
      actor,
      "user.status_restored",
      reason,
    );
}

/* ── Strikes ─────────────────────────────────────────────────────────────── */

export async function activeStrikeCount(userId: string) {
  const trust = await getSettings("trust");
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(strikes)
    .where(
      and(
        eq(strikes.userId, userId),
        isNull(strikes.revokedAt),
        gt(strikes.createdAt, new Date(Date.now() - trust.strikeWindowDays * 86_400_000)),
        or(isNull(strikes.expiresAt), gt(strikes.expiresAt, new Date())),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Record a strike and, when enabled, apply the configured ladder step. The
 * ladder is data (Admin → Settings → Trust); nothing is hard-coded here.
 */
export async function addStrike(
  userId: string,
  violationType: string,
  reason: string,
  actor: AuditActor,
  sourceRef?: string,
) {
  const [trust, automation] = await Promise.all([getSettings("trust"), getSettings("automation")]);
  const [s] = await getDb()
    .insert(strikes)
    .values({
      userId,
      violationType,
      reason,
      sourceRef: sourceRef ?? null,
      createdById: actor.type === "admin" ? actor.id : null,
      source: actor.type === "system" ? actor.rule : null,
    })
    .returning({ id: strikes.id });
  const count = await activeStrikeCount(userId);
  await recordAudit({
    actor,
    action: "user.strike",
    target: { type: "user", id: userId },
    reason,
    meta: { violationType, strikeId: s.id, activeStrikes: count, sourceRef },
  });
  if (!trust.strikesEnabled || !automation.accountEnforcement) return { count, applied: null };
  const step = strikeStep(count, trust.strikeLadder);
  if (!step) return { count, applied: null };
  const ladder: AuditActor = { type: "system", rule: `strike-ladder:${count}` };
  const why = `${count} strike${count === 1 ? "" : "s"} (latest: ${violationType} — ${reason})`;
  if (step.action === "warn") await warnUser(userId, why, ladder, step.days ?? 30);
  else if (step.action === "restrict")
    await restrictUser(
      userId,
      step.features.length ? step.features : ["listings", "messaging"],
      why,
      ladder,
      step.days,
    );
  else if (step.action === "suspend") await suspendUser(userId, why, ladder, step.days);
  else await banUser(userId, why, ladder);
  return { count, applied: step.action };
}

export async function revokeStrike(strikeId: string, actor: AuditActor, reason: string) {
  const [s] = await getDb()
    .update(strikes)
    .set({ revokedAt: new Date() })
    .where(and(eq(strikes.id, strikeId), isNull(strikes.revokedAt)))
    .returning();
  if (s)
    await recordAudit({
      actor,
      action: "user.strike_revoked",
      target: { type: "user", id: s.userId },
      reason,
      meta: { strikeId },
    });
}

/* ── Scheduled: lift timed penalties ─────────────────────────────────────── */

export async function expireEnforcements(now = new Date()) {
  const db = getDb();
  const rule: AuditActor = { type: "system", rule: "enforcement-expiry" };
  let restored = 0;

  // Timed statuses (warned / suspended) that have run out.
  const due = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(
      and(
        inArray(users.status, ["warned", "suspended"]),
        isNotNull(users.statusUntil),
        lte(users.statusUntil, now),
      ),
    );
  for (const u of due) {
    const next = await baseStatus(u.id);
    await setStatus(
      u.id,
      { status: next, statusUntil: null, statusReason: null },
      rule,
      "user.status_expired",
      `${u.status} period ended`,
    );
    if (u.status === "suspended")
      await notify(
        u.id,
        { type: "account", title: "Your suspension has ended", body: "You can sign in again." },
        { email: true },
      );
    restored++;
  }

  // Restricted accounts whose last restriction has lapsed.
  const restricted = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.status, "restricted"));
  for (const u of restricted) {
    if ((await baseStatus(u.id)) === "active") {
      await setStatus(
        u.id,
        { status: "active", statusUntil: null, statusReason: null },
        rule,
        "user.status_expired",
        "restrictions ended",
      );
      await notify(
        u.id,
        {
          type: "account",
          title: "Restrictions on your account have ended",
          body: "All features are available again.",
        },
        { email: true },
      );
      restored++;
    }
  }
  return { restored };
}
