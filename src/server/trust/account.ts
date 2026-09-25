import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessions, users, verifications } from "@/server/db/schema";
import { recordAudit, type AuditActor } from "@/server/audit";
import { notify, sendEmail } from "@/server/notify";
import { hashPassword, passwordProblems } from "@/server/auth/password";
import { recomputeVerificationLevel } from "./verification";

/** Admin account management: change sign-in email, set a new password. */

export class AccountUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountUpdateError";
  }
}

export async function changeUserEmail(
  userId: string,
  newEmail: string,
  opts: { markVerified: boolean; reason: string; actor: AuditActor },
) {
  const email = newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AccountUpdateError("Enter a valid email.");
  const db = getDb();
  const [before] = await db
    .select({ email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!before) throw new AccountUpdateError("User not found.");
  if (before.email.toLowerCase() === email)
    throw new AccountUpdateError("That's already their email.");
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (taken) throw new AccountUpdateError("Another account already uses that email.");

  await db
    .update(users)
    .set({ email, emailVerifiedAt: opts.markVerified ? new Date() : null })
    .where(eq(users.id, userId));
  // Codes sent to the old address must not verify the new one.
  await db
    .update(verifications)
    .set({ status: "cancelled", codeHash: null })
    .where(
      and(
        eq(verifications.userId, userId),
        eq(verifications.kind, "email"),
        eq(verifications.status, "pending"),
      ),
    );
  if (opts.markVerified)
    await db.insert(verifications).values({
      userId,
      kind: "email",
      status: "approved",
      provider: opts.actor.type === "admin" ? "admin" : "system",
      subject: email,
      reviewerId: opts.actor.type === "admin" ? opts.actor.id : null,
      reviewedAt: new Date(),
      decisionReason: opts.reason,
    });
  await recordAudit({
    actor: opts.actor,
    action: "user.email_changed",
    target: { type: "user", id: userId },
    reason: opts.reason,
    before: { email: before.email, emailVerified: before.emailVerifiedAt !== null },
    after: { email, emailVerified: opts.markVerified },
  });
  const level = await recomputeVerificationLevel(userId, opts.actor);
  const notice = `The sign-in email for your Dwellwise account was changed from ${before.email} to ${email} by our support team.\n\nReason: ${opts.reason}\n\nIf you didn't ask for this, contact support right away.`;
  // Tell the old address too — it's the one an attacker would want to cut out.
  await sendEmail(before.email, "Your Dwellwise email was changed", notice);
  await notify(
    userId,
    { type: "account", title: "Your account email was changed", body: notice },
    { email: true },
  );
  return { email, level };
}

export async function setUserPassword(
  userId: string,
  password: string,
  opts: { reason: string; actor: AuditActor },
) {
  const problem = passwordProblems(password);
  if (problem) throw new AccountUpdateError(problem);
  const db = getDb();
  const [u] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (!u) throw new AccountUpdateError("User not found.");
  const ended = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id });
  // Never log the password itself — only that it changed.
  await recordAudit({
    actor: opts.actor,
    action: "user.password_set",
    target: { type: "user", id: userId },
    reason: opts.reason,
    meta: { sessionsEnded: ended.length },
  });
  await notify(
    userId,
    {
      type: "account",
      title: "Your password was changed",
      body: `An administrator set a new password for your account and signed you out of all devices.\n\nReason: ${opts.reason}\n\nIf you didn't ask for this, contact support right away.`,
    },
    { email: true },
  );
  return { sessionsEnded: ended.length };
}
