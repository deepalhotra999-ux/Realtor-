import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, like, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  agentProfiles,
  auditLogs,
  listings,
  properties,
  sessions,
  users,
  verifications,
} from "@/server/db/schema";
import {
  confirmContactCode,
  decideVerification,
  expireVerifications,
  recomputeVerificationLevel,
  requestContactCode,
  revokeVerification,
  submitDocumentCheck,
  VerificationError,
} from "@/server/trust/verification";
import {
  addStrike,
  assertFeatureAllowed,
  AccountRestrictedError,
  banUser,
  expireEnforcements,
  isFeatureAllowed,
  liftRestriction,
  activeRestrictions,
  reinstateUser,
  restrictUser,
  suspendUser,
} from "@/server/trust/enforcement";
import { assertCanMessage, assertCanPublish, TrustError } from "@/server/trust/permissions";
import { ownerInGoodStanding } from "@/server/search/postgres";
import { changeUserEmail, setUserPassword } from "@/server/trust/account";
import { verifyPassword } from "@/server/auth/password";

const DOMAIN = "@int.test";
const admin = { type: "admin" as const, id: "" };
let seq = 0;

async function makeUser(
  role: "consumer" | "agent" = "consumer",
  opts: { emailVerified?: boolean; ageDays?: number } = {},
) {
  const db = getDb();
  const [u] = await db
    .insert(users)
    .values({
      email: `t${Date.now()}${seq++}${DOMAIN}`,
      name: `Test ${role} ${seq}`,
      role,
      emailVerifiedAt: opts.emailVerified ? new Date() : null,
      createdAt: new Date(Date.now() - (opts.ageDays ?? 0) * 86_400_000),
    })
    .returning();
  if (role === "agent") await db.insert(agentProfiles).values({ userId: u.id, slug: `t-${u.id}` });
  return u;
}

const level = async (id: string) =>
  (await getDb().select({ l: users.verificationLevel }).from(users).where(eq(users.id, id)))[0].l;
const status = async (id: string) =>
  (
    await getDb()
      .select({ s: users.status, until: users.statusUntil })
      .from(users)
      .where(eq(users.id, id))
  )[0];
const doc = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "id.png", { type: "image/png" });

async function cleanup() {
  const db = getDb();
  const test = sql`(select id from users where email like ${"%" + DOMAIN})`;
  await db
    .delete(listings)
    .where(sql`${listings.ownerId} in ${test} or ${listings.agentId} in ${test}`);
  await db
    .delete(auditLogs)
    .where(
      sql`${auditLogs.targetId} in (select id::text from users where email like ${"%" + DOMAIN})`,
    );
  await db.delete(users).where(like(users.email, `%${DOMAIN}`));
}

beforeAll(async () => {
  await cleanup();
  const [a] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  admin.id = a.id;
});
afterAll(cleanup);

describe("email/phone verification codes", () => {
  it("confirms with the right code, counts wrong attempts, and raises the level", async () => {
    const u = await makeUser();
    expect(await level(u.id)).toBe(0);
    const { devCode } = await requestContactCode(u, "email");
    expect(devCode).toMatch(/^\d{6}$/);
    await expect(requestContactCode(u, "email")).rejects.toThrow(/wait a minute/i);
    const wrong = devCode === "000000" ? "111111" : "000000";
    await expect(confirmContactCode(u.id, "email", wrong)).rejects.toThrow(/attempt\(s\) left/);
    expect(await confirmContactCode(u.id, "email", devCode!)).toBe(1);
    expect(await level(u.id)).toBe(1);
  });

  it("rejects malformed phone numbers", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    await expect(requestContactCode(u, "phone", "12")).rejects.toBeInstanceOf(VerificationError);
  });
});

describe("identity & license checks", () => {
  it("level 2 for an approved identity; license is only for professionals", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    await recomputeVerificationLevel(u.id);
    const id = await submitDocumentCheck(
      u,
      "identity",
      { legalName: "Test Person", documentType: "passport", documentCountry: "US" },
      [doc()],
    );
    await expect(
      submitDocumentCheck(
        u,
        "identity",
        { legalName: "x", documentType: "passport", documentCountry: "US" },
        [doc()],
      ),
    ).rejects.toThrow(/already have a check/);
    const [row] = await getDb().select().from(verifications).where(eq(verifications.id, id));
    expect(row.documentKeys[0]).toMatch(/^private\/verification\//);
    expect(await decideVerification(id, "approved", "ok", admin)).toBe(2);
    await expect(
      submitDocumentCheck(u, "license", { licenseNumber: "X1", licenseState: "TX" }, [doc()]),
    ).rejects.toThrow(/professionals/);
  });

  it("level 3 turns the agent badge on; revoking or expiring the license turns it off", async () => {
    const u = await makeUser("agent", { emailVerified: true });
    const idv = await submitDocumentCheck(
      u,
      "identity",
      { legalName: "A", documentType: "passport", documentCountry: "US" },
      [doc()],
    );
    await decideVerification(idv, "approved", "ok", admin);
    const lic = await submitDocumentCheck(
      u,
      "license",
      { licenseNumber: "TX-123", licenseState: "tx" },
      [doc()],
    );
    expect(await decideVerification(lic, "approved", "ok", admin)).toBe(3);
    const badge = async () =>
      (
        await getDb()
          .select({ v: agentProfiles.verified, n: agentProfiles.licenseNumber })
          .from(agentProfiles)
          .where(eq(agentProfiles.userId, u.id))
      )[0];
    expect(await badge()).toEqual({ v: true, n: "TX-123" });

    expect(await revokeVerification(lic, "license lapsed", admin)).toBe(2);
    expect((await badge()).v).toBe(false);

    const lic2 = await submitDocumentCheck(
      u,
      "license",
      { licenseNumber: "TX-124", licenseState: "TX" },
      [doc()],
    );
    await decideVerification(lic2, "approved", "ok", admin);
    expect(await level(u.id)).toBe(3);
    await getDb()
      .update(verifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verifications.id, lic2));
    await expireVerifications();
    expect(await level(u.id)).toBe(2);
    const [expired] = await getDb()
      .select({ s: verifications.status })
      .from(verifications)
      .where(eq(verifications.id, lic2));
    expect(expired.s).toBe("expired");
  });
});

describe("account enforcement", () => {
  it("suspends with sign-out, then restores automatically when the period ends", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    await getDb()
      .insert(sessions)
      .values({ id: `test-${u.id}`, userId: u.id, expiresAt: new Date(Date.now() + 86_400_000) });
    await suspendUser(u.id, "testing", admin, 3);
    expect((await status(u.id)).s).toBe("suspended");
    expect(await getDb().select().from(sessions).where(eq(sessions.userId, u.id))).toHaveLength(0);
    await expect(assertFeatureAllowed(u.id, "messaging")).rejects.toBeInstanceOf(
      AccountRestrictedError,
    );

    await getDb()
      .update(users)
      .set({ statusUntil: new Date(Date.now() - 1000) })
      .where(eq(users.id, u.id));
    expect((await expireEnforcements()).restored).toBeGreaterThanOrEqual(1);
    expect((await status(u.id)).s).toBe("active");
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.targetId, u.id), eq(auditLogs.action, "user.status_expired")));
    expect(log.actorType).toBe("system");
    expect(log.actorLabel).toBe("enforcement-expiry");
  });

  it("restricts only the chosen features, and an admin can lift it", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    await restrictUser(u.id, ["messaging"], "spam", admin, 7);
    expect((await status(u.id)).s).toBe("restricted");
    expect(await isFeatureAllowed(u.id, "messaging")).toBe(false);
    expect(await isFeatureAllowed(u.id, "listings")).toBe(true);
    const [r] = await activeRestrictions(u.id);
    await liftRestriction(r.id, admin);
    expect(await isFeatureAllowed(u.id, "messaging")).toBe(true);
    expect((await status(u.id)).s).toBe("active");
  });

  it("applies the strike ladder automatically (warn → restrict)", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    expect(await addStrike(u.id, "spam", "first", admin)).toMatchObject({
      count: 1,
      applied: "warn",
    });
    expect((await status(u.id)).s).toBe("warned");
    expect(await addStrike(u.id, "spam", "second", admin)).toMatchObject({
      count: 2,
      applied: "restrict",
    });
    expect(await isFeatureAllowed(u.id, "messaging")).toBe(false);
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.targetId, u.id), eq(auditLogs.action, "user.restrict")));
    expect(log.actorLabel).toBe("strike-ladder:2");
  });

  it("hides a banned owner's listings and restores them on reinstatement", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    const [p] = await getDb()
      .insert(properties)
      .values({
        propertyType: "condo",
        street: "1 Test St",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        latitude: 30.27,
        longitude: -97.74,
        location: { x: -97.74, y: 30.27 },
      })
      .returning({ id: properties.id });
    const [l] = await getDb()
      .insert(listings)
      .values({
        slug: `int-${u.id}`,
        propertyId: p.id,
        listingType: "sale",
        status: "active",
        price: 1,
        title: "t",
        ownerId: u.id,
      })
      .returning({ id: listings.id });
    const visible = async () =>
      (
        await getDb()
          .select({ n: sql<number>`count(*)::int` })
          .from(listings)
          .where(and(eq(listings.id, l.id), ownerInGoodStanding))
      )[0].n;
    expect(await visible()).toBe(1);
    await banUser(u.id, "fraud", admin);
    expect(await visible()).toBe(0);
    await reinstateUser(u.id, "appeal accepted", admin);
    expect(await visible()).toBe(1);
    await getDb().delete(properties).where(eq(properties.id, p.id));
  });
});

describe("admin account management", () => {
  it("changes email: unverified by default, drops the level, and blocks duplicates", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    await recomputeVerificationLevel(u.id);
    expect(await level(u.id)).toBe(1);
    const next = `new${Date.now()}${DOMAIN}`;
    const res = await changeUserEmail(u.id, next.toUpperCase(), {
      markVerified: false,
      reason: "ticket 1",
      actor: admin,
    });
    expect(res).toEqual({ email: next, level: 0 });
    const other = await makeUser("consumer");
    await expect(
      changeUserEmail(other.id, next, { markVerified: false, reason: "x", actor: admin }),
    ).rejects.toThrow(/already uses/);
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.targetId, u.id), eq(auditLogs.action, "user.email_changed")));
    expect(log.before).toMatchObject({ email: u.email, emailVerified: true });
    expect(log.after).toMatchObject({ email: next, emailVerified: false });
    expect(log.actorId).toBe(admin.id);
  });

  it("keeps the level when the admin confirms the new address", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    await recomputeVerificationLevel(u.id);
    const res = await changeUserEmail(u.id, `ok${Date.now()}${DOMAIN}`, {
      markVerified: true,
      reason: "checked",
      actor: admin,
    });
    expect(res.level).toBe(1);
  });

  it("sets a password that works, signs the user out, and never logs it", async () => {
    const u = await makeUser("consumer", { emailVerified: true });
    await getDb()
      .insert(sessions)
      .values({ id: `pw-${u.id}`, userId: u.id, expiresAt: new Date(Date.now() + 86_400_000) });
    await expect(setUserPassword(u.id, "short", { reason: "x", actor: admin })).rejects.toThrow(
      /8 characters/,
    );
    expect(
      await setUserPassword(u.id, "Brand-New-Pass-42", { reason: "locked out", actor: admin }),
    ).toEqual({ sessionsEnded: 1 });
    const [row] = await getDb()
      .select({ h: users.passwordHash })
      .from(users)
      .where(eq(users.id, u.id));
    expect(await verifyPassword("Brand-New-Pass-42", row.h)).toBe(true);
    const logs = await getDb().select().from(auditLogs).where(eq(auditLogs.targetId, u.id));
    expect(JSON.stringify(logs)).not.toContain("Brand-New-Pass-42");
  });
});

describe("permissions", () => {
  it("requires a verified email to message, and blocks links on probation", async () => {
    const unverified = await makeUser("consumer");
    await expect(assertCanMessage(unverified.id, "hi")).rejects.toBeInstanceOf(TrustError);
    const fresh = await makeUser("consumer", { emailVerified: true });
    await recomputeVerificationLevel(fresh.id);
    await expect(assertCanMessage(fresh.id, "hello")).resolves.toBeUndefined();
    await expect(assertCanMessage(fresh.id, "pay here: www.pay-now.xyz")).rejects.toThrow(/links/i);
  });

  it("gates publishing by verification level and flags low levels for review", async () => {
    const seller = await makeUser("consumer", { emailVerified: true });
    await recomputeVerificationLevel(seller.id);
    await expect(assertCanPublish(seller.id, false)).rejects.toThrow(/level 2/);
    const agent = await makeUser("agent", { emailVerified: true, ageDays: 60 });
    await recomputeVerificationLevel(agent.id);
    expect(await assertCanPublish(agent.id, false)).toEqual({ needsReview: true });
  });
});
