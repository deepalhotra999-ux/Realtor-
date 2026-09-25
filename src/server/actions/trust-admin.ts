"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { users, verifications } from "@/server/db/schema";
import { changeUserEmail, setUserPassword } from "@/server/trust/account";
import { requireAdmin } from "@/server/auth/session";
import { getSettings, updateSettings } from "@/server/settings";
import { enqueue } from "@/server/jobs/queue";
import {
  addStrike,
  banUser,
  liftRestriction,
  reinstateUser,
  restrictUser,
  revokeStrike,
  suspendUser,
  warnUser,
} from "@/server/trust/enforcement";
import {
  decideVerification,
  recomputeVerificationLevel,
  revokeVerification,
  VerificationError,
} from "@/server/trust/verification";
import {
  RESTRICTABLE_FEATURES,
  STRIKE_ACTIONS,
  trustSettingsSchema,
  type RestrictableFeature,
} from "@/lib/settings-schema";

export type TrustAdminState = { ok?: boolean; error?: string; message?: string } | undefined;

const uuid = z.string().uuid();
const reasonOf = (form: FormData) =>
  z
    .string()
    .trim()
    .min(3, "Give a reason (it's shown to the user and kept in the audit log).")
    .max(500)
    .safeParse(form.get("reason"));
const optDays = (form: FormData) => {
  const v = String(form.get("days") ?? "").trim();
  if (v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= 3650 ? n : null;
};

/** Load the target and refuse to act on yourself or another admin. */
async function target(adminId: string, userId: string) {
  const id = uuid.parse(userId);
  if (id === adminId) throw new Error("You can't take enforcement action on your own account.");
  const [u] = await getDb()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!u) throw new Error("User not found.");
  if (u.role === "admin") throw new Error("Change this admin's role first.");
  return id;
}

function done(userId: string, message: string): TrustAdminState {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/trust");
  return { ok: true, message };
}

async function run(fn: () => Promise<TrustAdminState>): Promise<TrustAdminState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof VerificationError || err instanceof Error) return { error: err.message };
    throw err;
  }
}

export async function enforceAction(
  userId: string,
  _prev: TrustAdminState,
  form: FormData,
): Promise<TrustAdminState> {
  const admin = await requireAdmin();
  return run(async () => {
    const id = await target(admin.id, userId);
    const reason = reasonOf(form);
    if (!reason.success) return { error: reason.error.issues[0]?.message };
    const actor = { type: "admin" as const, id: admin.id };
    const days = optDays(form);
    const action = z
      .enum(["warn", "restrict", "suspend", "ban", "reinstate"])
      .parse(form.get("action"));
    switch (action) {
      case "warn":
        await warnUser(id, reason.data, actor, days ?? 30);
        return done(id, "Warning recorded and the user notified.");
      case "restrict": {
        const features = form
          .getAll("features")
          .map(String)
          .filter((f): f is RestrictableFeature =>
            (RESTRICTABLE_FEATURES as readonly string[]).includes(f),
          );
        if (!features.length) return { error: "Choose at least one feature to restrict." };
        await restrictUser(id, features, reason.data, actor, days);
        return done(
          id,
          `Restricted ${features.length} feature(s)${days ? ` for ${days} days` : ""}.`,
        );
      }
      case "suspend":
        await suspendUser(id, reason.data, actor, days);
        return done(
          id,
          `Suspended${days ? ` for ${days} days` : " until reinstated"} and signed out.`,
        );
      case "ban":
        await banUser(id, reason.data, actor);
        return done(id, "Account banned and signed out. Their listings are hidden.");
      case "reinstate":
        await reinstateUser(id, reason.data, actor);
        return done(id, "Access restored and all restrictions lifted.");
    }
  });
}

export async function liftRestrictionAction(userId: string, restrictionId: string) {
  const admin = await requireAdmin();
  await liftRestriction(uuid.parse(restrictionId), { type: "admin", id: admin.id });
  revalidatePath(`/admin/users/${userId}`);
}

export async function addStrikeAction(
  userId: string,
  _prev: TrustAdminState,
  form: FormData,
): Promise<TrustAdminState> {
  const admin = await requireAdmin();
  return run(async () => {
    const id = await target(admin.id, userId);
    const reason = reasonOf(form);
    if (!reason.success) return { error: reason.error.issues[0]?.message };
    const type = z.string().trim().min(2).max(40).parse(form.get("violationType"));
    const res = await addStrike(id, type, reason.data, { type: "admin", id: admin.id });
    return done(
      id,
      `Strike recorded (${res.count} active).${res.applied ? ` Strike rules applied: ${res.applied}.` : ""}`,
    );
  });
}

export async function revokeStrikeAction(userId: string, strikeId: string) {
  const admin = await requireAdmin();
  await revokeStrike(uuid.parse(strikeId), { type: "admin", id: admin.id }, "Revoked by admin");
  revalidatePath(`/admin/users/${userId}`);
}

export async function decideVerificationAction(
  verificationId: string,
  _prev: TrustAdminState,
  form: FormData,
): Promise<TrustAdminState> {
  const admin = await requireAdmin();
  return run(async () => {
    const decision = z.enum(["approved", "rejected"]).parse(form.get("decision"));
    const reason =
      String(form.get("reason") ?? "").trim() ||
      (decision === "approved" ? "Checked by reviewer" : "");
    if (decision === "rejected" && reason.length < 3)
      return { error: "Tell the user why it wasn't approved." };
    const level = await decideVerification(uuid.parse(verificationId), decision, reason, {
      type: "admin",
      id: admin.id,
    });
    revalidatePath("/admin/verifications");
    return {
      ok: true,
      message: `${decision === "approved" ? "Approved" : "Rejected"} — user is now level ${level}.`,
    };
  });
}

export async function revokeVerificationAction(userId: string, verificationId: string) {
  const admin = await requireAdmin();
  await revokeVerification(uuid.parse(verificationId), "Revoked by admin", {
    type: "admin",
    id: admin.id,
  });
  revalidatePath(`/admin/users/${userId}`);
}

/** Admin override: record a check the admin completed outside the platform. */
export async function manualVerifyAction(
  userId: string,
  _prev: TrustAdminState,
  form: FormData,
): Promise<TrustAdminState> {
  const admin = await requireAdmin();
  return run(async () => {
    const id = uuid.parse(userId);
    const kind = z.enum(["email", "identity", "license"]).parse(form.get("kind"));
    const reason = reasonOf(form);
    if (!reason.success) return { error: reason.error.issues[0]?.message };
    const actor = { type: "admin" as const, id: admin.id };
    if (kind === "email") {
      await getDb().update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, id));
      await getDb().insert(verifications).values({
        userId: id,
        kind: "email",
        status: "approved",
        provider: "admin",
        reviewerId: admin.id,
        reviewedAt: new Date(),
        decisionReason: reason.data,
      });
      const level = await recomputeVerificationLevel(id, actor);
      return done(id, `Email marked verified — level ${level}.`);
    }
    const [row] = await getDb()
      .insert(verifications)
      .values({ userId: id, kind, status: "pending", provider: "admin", data: { manual: "true" } })
      .returning({ id: verifications.id });
    const level = await decideVerification(row.id, "approved", reason.data, actor);
    return done(
      id,
      `${kind === "license" ? "License" : "Identity"} marked verified — level ${level}.`,
    );
  });
}

/* ── Account management (admin override) ─────────────────────────────────── */

/**
 * Change a user's sign-in email. The new address is unverified unless the
 * admin confirms they verified it; both addresses get a security notice.
 */
export async function updateUserEmailAction(
  userId: string,
  _prev: TrustAdminState,
  form: FormData,
): Promise<TrustAdminState> {
  const admin = await requireAdmin();
  return run(async () => {
    const id = await target(admin.id, userId);
    const reason = reasonOf(form);
    if (!reason.success) return { error: reason.error.issues[0]?.message };
    const verified = form.get("markVerified") === "on";
    const res = await changeUserEmail(id, String(form.get("email") ?? ""), {
      markVerified: verified,
      reason: reason.data,
      actor: { type: "admin", id: admin.id },
    });
    return done(
      id,
      `Email changed to ${res.email}${verified ? " (verified)" : " — the user must verify it"}. Level ${res.level}.`,
    );
  });
}

/** Set a new password (e.g. a locked-out user). Signs the user out everywhere. */
export async function setUserPasswordAction(
  userId: string,
  _prev: TrustAdminState,
  form: FormData,
): Promise<TrustAdminState> {
  const admin = await requireAdmin();
  return run(async () => {
    const id = await target(admin.id, userId);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? ""))
      return { error: "The passwords don't match." };
    const reason = reasonOf(form);
    if (!reason.success) return { error: reason.error.issues[0]?.message };
    const res = await setUserPassword(id, password, {
      reason: reason.data,
      actor: { type: "admin", id: admin.id },
    });
    return done(id, `Password updated. ${res.sessionsEnded} session(s) signed out.`);
  });
}

/* ── Trust settings ──────────────────────────────────────────────────────── */

const intOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Math.max(0, Math.round(Number(s)));
};
const int = (v: FormDataEntryValue | null, fallback: number) => {
  const n = Math.round(Number(String(v ?? "")));
  return Number.isFinite(n) ? n : fallback;
};
type Tier = "probation" | "standard" | "trusted";
const LIMIT_KEYS = [
  "activeListings",
  "messagesPerDay",
  "contactsPerDay",
  "linksPerMessage",
  "activePromotions",
  "actionsPerDay",
] as const;

export async function saveTrustSettingsAction(
  _prev: TrustAdminState,
  form: FormData,
): Promise<TrustAdminState> {
  const admin = await requireAdmin();
  const limits = (tier: Tier) =>
    Object.fromEntries(LIMIT_KEYS.map((k) => [k, intOrNull(form.get(`${tier}.${k}`))]));
  const ladder = [0, 1, 2, 3, 4, 5]
    .map((i) => ({
      strikes: int(form.get(`ladder.${i}.strikes`), 0),
      action: String(form.get(`ladder.${i}.action`) ?? ""),
      days: intOrNull(form.get(`ladder.${i}.days`)),
      features: form.getAll(`ladder.${i}.features`).map(String),
    }))
    .filter((s) => s.strikes > 0 && (STRIKE_ACTIONS as readonly string[]).includes(s.action));
  const parsed = trustSettingsSchema.safeParse({
    publishLevel: {
      consumer: int(form.get("publish.consumer"), 2),
      agent: int(form.get("publish.agent"), 1),
      broker: int(form.get("publish.broker"), 1),
      property_manager: int(form.get("publish.property_manager"), 1),
      developer: int(form.get("publish.developer"), 2),
    },
    sellerListingsEnabled: form.get("sellerListingsEnabled") === "on",
    reviewListingsBelowLevel: int(form.get("reviewListingsBelowLevel"), 2),
    requirePhoneForLevel1: form.get("requirePhoneForLevel1") === "on",
    requireEmailToInteract: form.get("requireEmailToInteract") === "on",
    verificationCodeTtlMinutes: int(form.get("verificationCodeTtlMinutes"), 15),
    verificationCodeMaxAttempts: int(form.get("verificationCodeMaxAttempts"), 5),
    identityValidDays: intOrNull(form.get("identityValidDays")),
    licenseValidDays: intOrNull(form.get("licenseValidDays")),
    documentRetentionDays: int(form.get("documentRetentionDays"), 30),
    probationDays: int(form.get("probationDays"), 14),
    probationLimits: limits("probation"),
    standardLimits: limits("standard"),
    trustedLimits: limits("trusted"),
    strikesEnabled: form.get("strikesEnabled") === "on",
    strikeWindowDays: int(form.get("strikeWindowDays"), 180),
    violationTypes: String(form.get("violationTypes") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
      .filter(Boolean),
    strikeLadder: ladder,
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${i?.path.join(".") ?? "settings"}: ${i?.message ?? "invalid"}` };
  }
  if (
    new Set(parsed.data.strikeLadder.map((s) => s.strikes)).size !== parsed.data.strikeLadder.length
  )
    return { error: "Each strike-ladder step needs a different strike count." };
  const before = await getSettings("trust");
  await updateSettings("trust", parsed.data, admin.id);
  // Levels are derived from this setting: re-derive every account in the background.
  const relevel = before.requirePhoneForLevel1 !== parsed.data.requirePhoneForLevel1;
  if (relevel) await enqueue("trust.recompute_levels", {}, { dedupeKey: "trust.recompute_levels" });
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: relevel
      ? "Trust settings saved. Verification levels are being recalculated in the background."
      : "Trust settings saved.",
  };
}
