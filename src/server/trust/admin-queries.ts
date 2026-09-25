import "server-only";
import { and, count, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  accountRestrictions,
  accountSignals,
  agentProfiles,
  auditLogs,
  listings,
  properties,
  reports,
  strikes,
  users,
  verifications,
} from "@/server/db/schema";
import { activeStrikeCount } from "./enforcement";

/** Everything an admin needs to investigate one account, in one place. */
export async function getUserInvestigation(userId: string) {
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  const [
    profile,
    checks,
    restrictionRows,
    strikeRows,
    history,
    signals,
    userListings,
    reportRows,
    activeStrikes,
  ] = await Promise.all([
    db.select().from(agentProfiles).where(eq(agentProfiles.userId, userId)).limit(1),
    db
      .select()
      .from(verifications)
      .where(eq(verifications.userId, userId))
      .orderBy(desc(verifications.createdAt))
      .limit(30),
    db
      .select()
      .from(accountRestrictions)
      .where(eq(accountRestrictions.userId, userId))
      .orderBy(desc(accountRestrictions.createdAt))
      .limit(30),
    db
      .select()
      .from(strikes)
      .where(eq(strikes.userId, userId))
      .orderBy(desc(strikes.createdAt))
      .limit(30),
    db
      .select({ a: auditLogs, actor: users.email })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(
        or(
          and(eq(auditLogs.targetType, "user"), eq(auditLogs.targetId, userId)),
          eq(auditLogs.actorId, userId),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(40),
    db
      .select()
      .from(accountSignals)
      .where(eq(accountSignals.userId, userId))
      .orderBy(desc(accountSignals.createdAt))
      .limit(20),
    db
      .select({
        id: listings.id,
        slug: listings.slug,
        title: listings.title,
        status: listings.status,
        city: properties.city,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .where(or(eq(listings.agentId, userId), eq(listings.ownerId, userId)))
      .orderBy(desc(listings.createdAt))
      .limit(20),
    db
      .select()
      .from(reports)
      .where(
        or(
          eq(reports.subjectUserId, userId),
          and(eq(reports.targetType, "user"), eq(reports.targetId, userId)),
        ),
      )
      .orderBy(desc(reports.createdAt))
      .limit(20),
    activeStrikeCount(userId),
  ]);

  // Other accounts seen on the same network prefix or device (context only — shared
  // Wi-Fi is common, so this is never grounds for action by itself).
  const prefixes = [
    ...new Set(signals.map((s) => s.ipPrefix).filter((p): p is string => Boolean(p))),
  ];
  const devices = [
    ...new Set(signals.map((s) => s.deviceHash).filter((d): d is string => Boolean(d))),
  ];
  const related =
    prefixes.length || devices.length
      ? await db
          .select({
            userId: accountSignals.userId,
            name: users.name,
            email: users.email,
            status: users.status,
            sameDevice: sql<boolean>`bool_or(${devices.length ? inArray(accountSignals.deviceHash, devices) : sql`false`})`,
            sameNetwork: sql<boolean>`bool_or(${prefixes.length ? inArray(accountSignals.ipPrefix, prefixes) : sql`false`})`,
          })
          .from(accountSignals)
          .innerJoin(users, eq(users.id, accountSignals.userId))
          .where(
            and(
              isNotNull(accountSignals.userId),
              ne(accountSignals.userId, userId),
              or(
                devices.length ? inArray(accountSignals.deviceHash, devices) : sql`false`,
                prefixes.length ? inArray(accountSignals.ipPrefix, prefixes) : sql`false`,
              ),
            ),
          )
          .groupBy(accountSignals.userId, users.name, users.email, users.status)
          .limit(20)
      : [];

  return {
    user: u,
    profile: profile[0] ?? null,
    checks,
    restrictions: restrictionRows,
    strikes: strikeRows,
    activeStrikes,
    history,
    signals,
    related,
    listings: userListings,
    reports: reportRows,
  };
}

export async function listVerificationQueue(status: string) {
  const db = getDb();
  const where =
    status === "all"
      ? inArray(verifications.kind, ["identity", "license", "ownership"])
      : and(
          inArray(verifications.kind, ["identity", "license", "ownership"]),
          sql`${verifications.status} = ${status}`,
        );
  const [rows, counts] = await Promise.all([
    db
      .select({
        v: verifications,
        name: users.name,
        email: users.email,
        role: users.role,
        level: users.verificationLevel,
        accountCreated: users.createdAt,
      })
      .from(verifications)
      .innerJoin(users, eq(users.id, verifications.userId))
      .where(where)
      .orderBy(status === "pending" ? verifications.createdAt : desc(verifications.createdAt))
      .limit(100),
    db
      .select({ status: verifications.status, n: count() })
      .from(verifications)
      .where(inArray(verifications.kind, ["identity", "license", "ownership"]))
      .groupBy(verifications.status),
  ]);
  return {
    rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>,
  };
}

export async function pendingVerificationCount() {
  try {
    const [r] = await getDb()
      .select({ n: count() })
      .from(verifications)
      .where(
        and(
          eq(verifications.status, "pending"),
          inArray(verifications.kind, ["identity", "license", "ownership"]),
        ),
      );
    return r.n;
  } catch {
    return 0;
  }
}
