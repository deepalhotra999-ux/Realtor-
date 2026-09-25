import "server-only";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { leads, listings, messages, tours, users } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import {
  countLinks,
  limitsFor,
  limitTier,
  publishDecision,
  withinLimit,
  type Role,
} from "@/lib/trust";
import { assertFeatureAllowed } from "./enforcement";

/**
 * Server-side permission checks for marketplace actions: verification level,
 * account restrictions and new-account (probation) limits. Called from server
 * actions — the UI only mirrors these rules.
 */

export class TrustError extends Error {
  constructor(
    message: string,
    /** Where the user can fix it (e.g. the verification page). */
    readonly href?: string,
  ) {
    super(message);
    this.name = "TrustError";
  }
}

const VERIFY = "/account/verification";
const DAY_AGO = () => new Date(Date.now() - 86_400_000);

async function account(userId: string) {
  const [u] = await getDb()
    .select({
      id: users.id,
      role: users.role,
      createdAt: users.createdAt,
      level: users.verificationLevel,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) throw new TrustError("Account not found.");
  return { ...u, role: u.role as Role };
}

export async function accountLimits(userId: string) {
  const [a, trust] = await Promise.all([account(userId), getSettings("trust")]);
  const tier = limitTier(a, trust);
  return { account: a, tier, limits: limitsFor(tier, trust), trust };
}

async function requireVerifiedEmail(a: { emailVerifiedAt: Date | null }) {
  const trust = await getSettings("trust");
  if (trust.requireEmailToInteract && !a.emailVerifiedAt)
    throw new TrustError("Verify your email address first.", VERIFY);
}

async function actionsToday(userId: string) {
  const since = DAY_AGO();
  const db = getDb();
  const [[m], [l], [c]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.senderId, userId), gt(messages.createdAt, since))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(
        and(
          or(eq(listings.agentId, userId), eq(listings.ownerId, userId)),
          gt(listings.createdAt, since),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.contactUserId, userId), gt(leads.createdAt, since))),
  ]);
  return { messages: m.n, listings: l.n, contacts: c.n, total: m.n + l.n + c.n };
}

function limitError(what: string, limit: number, tier: string) {
  return new TrustError(
    tier === "probation"
      ? `New accounts can do this ${limit} time${limit === 1 ? "" : "s"} per day (${what}). Verifying your account raises the limit.`
      : `You've reached today's limit for ${what} (${limit}).`,
    tier === "probation" ? VERIFY : undefined,
  );
}

/** Create or edit a listing draft (publishing is checked separately). */
export async function assertCanEditListings(userId: string) {
  await assertFeatureAllowed(userId, "listings");
  const { limits, tier } = await accountLimits(userId);
  const today = await actionsToday(userId);
  if (!withinLimit(today.total, limits.actionsPerDay))
    throw limitError("account activity", limits.actionsPerDay!, tier);
}

/**
 * Publish a listing. Returns whether it must wait for review first.
 * `alreadyLive` listings don't count again toward the active-listing cap.
 */
export async function assertCanPublish(userId: string, alreadyLive: boolean) {
  await assertFeatureAllowed(userId, "listings");
  const { account: a, limits, tier, trust } = await accountLimits(userId);
  const d = publishDecision(a.role, a.level, trust);
  if (!d.allowed)
    throw new TrustError(
      d.reason === "role"
        ? "Listing publishing isn't available for this account type."
        : `Publishing requires verification level ${d.requiredLevel} — you're at level ${a.level}.`,
      d.reason === "level" ? VERIFY : undefined,
    );
  if (!alreadyLive && limits.activeListings !== null) {
    const [row] = await getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(
        and(
          or(eq(listings.agentId, userId), eq(listings.ownerId, userId)),
          inArray(listings.status, ["active", "coming_soon", "pending", "pending_review"]),
        ),
      );
    if (!withinLimit(row.n, limits.activeListings))
      throw new TrustError(
        tier === "probation"
          ? `New accounts can have ${limits.activeListings} live listing${limits.activeListings === 1 ? "" : "s"}. Verify your account to list more.`
          : `You've reached the limit of ${limits.activeListings} live listings.`,
        tier === "probation" ? VERIFY : undefined,
      );
  }
  return { needsReview: d.needsReview };
}

export async function assertCanMessage(userId: string, body: string) {
  const a = await account(userId);
  await requireVerifiedEmail(a);
  await assertFeatureAllowed(userId, "messaging");
  const { limits, tier } = await accountLimits(userId);
  const today = await actionsToday(userId);
  if (!withinLimit(today.messages, limits.messagesPerDay))
    throw limitError("messages", limits.messagesPerDay!, tier);
  if (!withinLimit(today.total, limits.actionsPerDay))
    throw limitError("account activity", limits.actionsPerDay!, tier);
  const links = countLinks(body);
  if (!withinLimit(0, limits.linksPerMessage, links))
    throw new TrustError(
      limits.linksPerMessage === 0
        ? "Links can't be included in messages yet. Verify your account to share links."
        : `Messages can include at most ${limits.linksPerMessage} link(s).`,
      limits.linksPerMessage === 0 ? VERIFY : undefined,
    );
}

/** Contact an agent, request a tour, or message a listing owner. */
export async function assertCanContact(userId: string, body = "") {
  const a = await account(userId);
  await requireVerifiedEmail(a);
  await assertFeatureAllowed(userId, "contact");
  const { limits, tier } = await accountLimits(userId);
  const since = DAY_AGO();
  const [[t]] = await Promise.all([
    getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(tours)
      .where(and(eq(tours.requesterId, userId), gt(tours.createdAt, since))),
  ]);
  const today = await actionsToday(userId);
  if (!withinLimit(today.contacts + t.n, limits.contactsPerDay))
    throw limitError("contact requests", limits.contactsPerDay!, tier);
  if (!withinLimit(today.total, limits.actionsPerDay))
    throw limitError("account activity", limits.actionsPerDay!, tier);
  if (!withinLimit(0, limits.linksPerMessage, countLinks(body)))
    throw new TrustError(
      "Please remove links from your message.",
      limits.linksPerMessage === 0 ? VERIFY : undefined,
    );
}

export async function assertCanReview(userId: string) {
  const a = await account(userId);
  await requireVerifiedEmail(a);
  await assertFeatureAllowed(userId, "reviews");
}
