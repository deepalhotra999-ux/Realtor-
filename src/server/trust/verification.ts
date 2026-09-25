import "server-only";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { agentProfiles, users, verifications } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { recordAudit, type AuditActor } from "@/server/audit";
import { notify, sendEmail, sendSms } from "@/server/notify";
import { getEmail, getIdentityVerification, getSms, getStorage } from "@/providers";
import { ALLOWED_UPLOAD_TYPES } from "@/providers/storage/types";
import { demoConveniences, getEnv } from "@/lib/env";
import { verificationLevel, type Role } from "@/lib/trust";

/**
 * VerificationService. Levels are always derived from verification records â€”
 * never set directly â€” so a badge can't outlive the check behind it.
 */

export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationError";
  }
}

type ContactKind = "email" | "phone";
type DocumentKind = "identity" | "license" | "ownership";

const hashCode = (verificationId: string, code: string) =>
  createHmac("sha256", getEnv().AUTH_SECRET).update(`${verificationId}:${code}`).digest("hex");

/** Recompute and persist a user's level (and the agent-profile badge that mirrors it). */
export async function recomputeVerificationLevel(userId: string, actor?: AuditActor) {
  const db = getDb();
  const [u] = await db
    .select({
      role: users.role,
      level: users.verificationLevel,
      emailVerifiedAt: users.emailVerifiedAt,
      phoneVerifiedAt: users.phoneVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return 0;
  const approved = await db
    .select({ kind: verifications.kind })
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, userId),
        eq(verifications.status, "approved"),
        inArray(verifications.kind, ["identity", "license"]),
        sql`(${verifications.expiresAt} is null or ${verifications.expiresAt} > now())`,
      ),
    );
  const trust = await getSettings("trust");
  const level = verificationLevel(
    {
      role: u.role as Role,
      emailVerified: u.emailVerifiedAt !== null,
      phoneVerified: u.phoneVerifiedAt !== null,
      identityApproved: approved.some((a) => a.kind === "identity"),
      licenseApproved: approved.some((a) => a.kind === "license"),
    },
    trust,
  );
  if (level !== u.level) {
    await db.update(users).set({ verificationLevel: level }).where(eq(users.id, userId));
    await recordAudit({
      actor: actor ?? { type: "system", rule: "verification-level" },
      action: "user.verification_level",
      target: { type: "user", id: userId },
      before: { verificationLevel: u.level },
      after: { verificationLevel: level },
    });
  }
  // The public "verified" badge on agent profiles tracks level 3 exactly.
  await db
    .update(agentProfiles)
    .set({ verified: level >= 3 })
    .where(and(eq(agentProfiles.userId, userId), ne(agentProfiles.verified, level >= 3)));
  return level;
}

/* â”€â”€ Email & phone codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function requestContactCode(
  user: { id: string; email: string },
  kind: ContactKind,
  phone?: string,
): Promise<{ sentTo: string; devCode?: string }> {
  const db = getDb();
  const trust = await getSettings("trust");
  const target = kind === "email" ? user.email : normalisePhone(phone ?? "");
  if (!target)
    throw new VerificationError("Enter a valid phone number, including the country code.");

  const [recent] = await db
    .select({ id: verifications.id })
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, user.id),
        eq(verifications.kind, kind),
        gt(verifications.createdAt, new Date(Date.now() - 60_000)),
      ),
    )
    .limit(1);
  if (recent)
    throw new VerificationError("A code was just sent. Wait a minute before asking again.");

  // Only the newest code is valid.
  await db
    .update(verifications)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(verifications.userId, user.id),
        eq(verifications.kind, kind),
        eq(verifications.status, "pending"),
      ),
    );

  const id = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const ttl = trust.verificationCodeTtlMinutes;
  await db.insert(verifications).values({
    id,
    userId: user.id,
    kind,
    status: "pending",
    provider: kind === "email" ? getEmail().name : getSms().name,
    subject: target,
    codeHash: hashCode(id, code),
    expiresAt: new Date(Date.now() + ttl * 60_000),
  });
  const text = `Your Dwellwise verification code is ${code}. It expires in ${ttl} minutes. If you didn't request it, you can ignore this message.`;
  if (kind === "email") await sendEmail(target, "Your Dwellwise verification code", text);
  else await sendSms(target, text);

  // Local outbox providers never deliver, so surface the code outside production.
  const outbox = (kind === "email" ? getEmail().name : getSms().name) === "outbox";
  return {
    sentTo: target,
    devCode: outbox && demoConveniences() ? code : undefined,
  };
}

export async function confirmContactCode(userId: string, kind: ContactKind, code: string) {
  const db = getDb();
  const trust = await getSettings("trust");
  const [v] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, userId),
        eq(verifications.kind, kind),
        eq(verifications.status, "pending"),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);
  if (!v || !v.codeHash) throw new VerificationError("Request a new code first.");
  if (v.expiresAt && v.expiresAt < new Date()) {
    await db.update(verifications).set({ status: "expired" }).where(eq(verifications.id, v.id));
    throw new VerificationError("That code has expired. Request a new one.");
  }
  const expected = Buffer.from(v.codeHash);
  const actual = Buffer.from(hashCode(v.id, code.trim()));
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!ok) {
    const attempts = v.attempts + 1;
    const exhausted = attempts >= trust.verificationCodeMaxAttempts;
    await db
      .update(verifications)
      .set({ attempts, status: exhausted ? "expired" : "pending" })
      .where(eq(verifications.id, v.id));
    throw new VerificationError(
      exhausted
        ? "Too many wrong attempts. Request a new code."
        : `That code isn't right. ${trust.verificationCodeMaxAttempts - attempts} attempt(s) left.`,
    );
  }
  const now = new Date();
  await db
    .update(verifications)
    .set({ status: "approved", reviewedAt: now, attempts: v.attempts + 1, codeHash: null })
    .where(eq(verifications.id, v.id));
  await db
    .update(users)
    .set(kind === "email" ? { emailVerifiedAt: now } : { phoneVerifiedAt: now, phone: v.subject })
    .where(eq(users.id, userId));
  await recordAudit({
    actor: { type: "user", id: userId },
    action: `verification.${kind}.confirmed`,
    target: { type: "user", id: userId },
  });
  return recomputeVerificationLevel(userId);
}

/** Loose E.164 normalisation: digits with a leading +, 8â€“15 digits. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  const withPlus = digits.startsWith("+") ? digits : `+1${digits}`; // default NANP
  return /^\+\d{8,15}$/.test(withPlus) ? withPlus : null;
}

/* â”€â”€ Identity / license / ownership checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const MAX_DOC_BYTES = 8 * 1024 * 1024;

export async function submitDocumentCheck(
  user: { id: string; role: string },
  kind: DocumentKind,
  fields: Record<string, string>,
  files: File[],
) {
  const db = getDb();
  if (
    kind === "license" &&
    !["agent", "broker", "property_manager", "developer"].includes(user.role)
  )
    throw new VerificationError("License verification is for real-estate professionals.");
  const [open] = await db
    .select({ id: verifications.id })
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, user.id),
        eq(verifications.kind, kind),
        eq(verifications.status, "pending"),
      ),
    )
    .limit(1);
  if (open) throw new VerificationError("You already have a check waiting for review.");

  const storage = getStorage();
  const keys: string[] = [];
  for (const f of files.slice(0, 3)) {
    const ext = ALLOWED_UPLOAD_TYPES[f.type];
    if (!ext) throw new VerificationError(`${f.name}: upload a JPEG, PNG, WebP or PDF.`);
    if (f.size > MAX_DOC_BYTES) throw new VerificationError(`${f.name} is larger than 8 MB.`);
    // Under private/ â€” never served by the public file route.
    const key = `private/verification/${user.id}/${randomUUID()}.${ext}`;
    await storage.put(key, new Uint8Array(await f.arrayBuffer()), f.type);
    keys.push(key);
  }
  const provider = getIdentityVerification();
  const res = await provider.start({ userId: user.id, kind, fields, documentKeys: keys });
  const [row] = await db
    .insert(verifications)
    .values({
      userId: user.id,
      kind,
      status: "pending",
      provider: provider.name,
      providerRef: res.ref,
      subject: fields.licenseNumber ?? fields.listingId ?? null,
      data: fields,
      documentKeys: keys,
    })
    .returning({ id: verifications.id });
  await recordAudit({
    actor: { type: "user", id: user.id },
    action: `verification.${kind}.submitted`,
    target: { type: "verification", id: row.id },
    meta: { provider: provider.name, documents: keys.length },
  });
  if (res.status !== "pending")
    await decideVerification(row.id, res.status, res.reason ?? "Decided by provider", {
      type: "system",
      rule: `provider:${provider.name}`,
    });
  return row.id;
}

/** Approve or reject a pending (or override an existing) document check. */
export async function decideVerification(
  id: string,
  decision: "approved" | "rejected",
  reason: string,
  actor: AuditActor,
) {
  const db = getDb();
  const trust = await getSettings("trust");
  const [v] = await db.select().from(verifications).where(eq(verifications.id, id)).limit(1);
  if (!v) throw new VerificationError("Verification not found.");
  if (v.kind === "email" || v.kind === "phone")
    throw new VerificationError("Contact checks are confirmed by code.");
  const now = new Date();
  const validDays =
    v.kind === "license"
      ? trust.licenseValidDays
      : v.kind === "identity"
        ? trust.identityValidDays
        : null;
  const [after] = await db
    .update(verifications)
    .set({
      status: decision,
      reviewerId: actor.type === "admin" ? actor.id : null,
      reviewedAt: now,
      decisionReason: reason,
      expiresAt:
        decision === "approved" && validDays
          ? new Date(now.getTime() + validDays * 86_400_000)
          : null,
      purgeAfter: new Date(now.getTime() + trust.documentRetentionDays * 86_400_000),
    })
    .where(eq(verifications.id, id))
    .returning();
  if (decision === "approved" && v.kind === "license") {
    const d = v.data as Record<string, string>;
    await db
      .update(agentProfiles)
      .set({
        licenseNumber: d.licenseNumber ?? null,
        licenseState: d.licenseState?.toUpperCase() ?? null,
      })
      .where(eq(agentProfiles.userId, v.userId));
  }
  await recordAudit({
    actor,
    action: `verification.${v.kind}.${decision}`,
    target: { type: "verification", id },
    reason,
    before: { status: v.status },
    after: { status: after.status, expiresAt: after.expiresAt },
    meta: { userId: v.userId },
  });
  const level = await recomputeVerificationLevel(v.userId, actor);
  const label =
    v.kind === "license"
      ? "professional license"
      : v.kind === "identity"
        ? "identity"
        : "property ownership";
  await notify(
    v.userId,
    {
      type: "account",
      title:
        decision === "approved" ? `Your ${label} is verified` : `We couldn't verify your ${label}`,
      body:
        decision === "approved"
          ? `Your account is now at verification level ${level}.`
          : `Reason: ${reason}\n\nYou can submit a new check from your verification page.`,
      link: "/account/verification",
    },
    { email: true },
  );
  return level;
}

/** Admin: withdraw an approved check (e.g. license revoked). */
export async function revokeVerification(id: string, reason: string, actor: AuditActor) {
  const db = getDb();
  const [v] = await db
    .update(verifications)
    .set({ status: "cancelled", decisionReason: reason, reviewedAt: new Date() })
    .where(eq(verifications.id, id))
    .returning();
  if (!v) throw new VerificationError("Verification not found.");
  if (v.kind === "email" || v.kind === "phone")
    await db
      .update(users)
      .set(v.kind === "email" ? { emailVerifiedAt: null } : { phoneVerifiedAt: null })
      .where(eq(users.id, v.userId));
  await recordAudit({
    actor,
    action: `verification.${v.kind}.revoked`,
    target: { type: "verification", id },
    reason,
    meta: { userId: v.userId },
  });
  return recomputeVerificationLevel(v.userId, actor);
}

/* â”€â”€ Scheduled maintenance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function expireVerifications(now = new Date()) {
  const db = getDb();
  const lapsed = await db
    .update(verifications)
    .set({ status: "expired" })
    .where(
      and(
        eq(verifications.status, "approved"),
        isNotNull(verifications.expiresAt),
        lt(verifications.expiresAt, now),
        inArray(verifications.kind, ["identity", "license", "ownership"]),
      ),
    )
    .returning({ id: verifications.id, userId: verifications.userId, kind: verifications.kind });
  for (const v of lapsed) {
    await recordAudit({
      actor: { type: "system", rule: "verification-expiry" },
      action: `verification.${v.kind}.expired`,
      target: { type: "verification", id: v.id },
      meta: { userId: v.userId },
    });
    await recomputeVerificationLevel(v.userId);
    await notify(
      v.userId,
      {
        type: "account",
        title: `Your ${v.kind === "license" ? "license" : v.kind} verification has expired`,
        body: "Please verify again to keep your verified status.",
        link: "/account/verification",
      },
      { email: true },
    );
  }
  // Unused codes simply lapse.
  const codes = await db
    .update(verifications)
    .set({ status: "expired", codeHash: null })
    .where(
      and(
        eq(verifications.status, "pending"),
        inArray(verifications.kind, ["email", "phone"]),
        lt(verifications.expiresAt, now),
      ),
    )
    .returning({ id: verifications.id });

  // Delete evidence past its retention date (the decision record stays).
  const toPurge = await db
    .select({ id: verifications.id, keys: verifications.documentKeys })
    .from(verifications)
    .where(
      and(lt(verifications.purgeAfter, now), sql`cardinality(${verifications.documentKeys}) > 0`),
    );
  const storage = getStorage();
  for (const v of toPurge) {
    for (const key of v.keys) await storage.delete(key).catch(() => {});
    await db.update(verifications).set({ documentKeys: [] }).where(eq(verifications.id, v.id));
  }
  return { expired: lapsed.length, codesExpired: codes.length, documentsPurged: toPurge.length };
}

/** Everything the verification page needs for one user. */
export async function getVerificationSummary(userId: string) {
  const db = getDb();
  const [u] = await db
    .select({
      role: users.role,
      level: users.verificationLevel,
      email: users.email,
      phone: users.phone,
      emailVerifiedAt: users.emailVerifiedAt,
      phoneVerifiedAt: users.phoneVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const rows = await db
    .select({
      id: verifications.id,
      kind: verifications.kind,
      status: verifications.status,
      decisionReason: verifications.decisionReason,
      expiresAt: verifications.expiresAt,
      createdAt: verifications.createdAt,
      reviewedAt: verifications.reviewedAt,
    })
    .from(verifications)
    .where(eq(verifications.userId, userId))
    .orderBy(desc(verifications.createdAt))
    .limit(30);
  const latest = (kind: string) =>
    rows.find((r) => r.kind === kind && r.status !== "cancelled") ?? null;
  return {
    user: u,
    identity: latest("identity"),
    license: latest("license"),
    emailPending: rows.some((r) => r.kind === "email" && r.status === "pending"),
    phonePending: rows.some((r) => r.kind === "phone" && r.status === "pending"),
  };
}
