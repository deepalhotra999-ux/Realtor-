import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  listings,
  planEntitlements,
  plans,
  subscriptions,
  usageCounters,
} from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { FEATURES, type FeatureKey } from "@/lib/entitlements/catalog";
import {
  proAccountAllowed,
  resolveEntitlement,
  withinLimit,
  type EntitlementContext,
  type EntitlementDecision,
  type EntitlementMap,
  type SubscriptionSnapshot,
} from "@/lib/entitlements/engine";

async function entitlementsFor(planId: string): Promise<EntitlementMap> {
  const rows = await getDb()
    .select()
    .from(planEntitlements)
    .where(eq(planEntitlements.planId, planId));
  return Object.fromEntries(
    rows.map((r) => [r.featureKey, { enabled: r.enabled, limit: r.limitValue }]),
  );
}

/** The subscription that currently matters for a user (newest non-expired). */
export async function getCurrentSubscription(userId: string) {
  const [row] = await getDb()
    .select({ sub: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ["trialing", "active", "past_due", "canceled"]),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return row ?? null;
}

export async function loadEntitlementContext(userId: string | null): Promise<EntitlementContext> {
  const [settings, ai] = await Promise.all([getSettings("monetization"), getSettings("ai")]);
  const ctx: EntitlementContext = {
    settings,
    freeAllowances: { [FEATURES.AI_REQUESTS]: ai.freeMonthlyRequests },
    subscription: null,
    defaultPlan: null,
  };
  // Free mode never needs plan lookups.
  if (!settings.subscriptionsEnabled) return ctx;

  const db = getDb();
  const [defaultPlan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.isDefault, true), eq(plans.isActive, true)))
    .limit(1);
  if (defaultPlan)
    ctx.defaultPlan = { key: defaultPlan.key, entitlements: await entitlementsFor(defaultPlan.id) };

  if (userId) {
    const current = await getCurrentSubscription(userId);
    if (current) {
      const snapshot: SubscriptionSnapshot = {
        planKey: current.plan.key,
        status: current.sub.status,
        trialEndsAt: current.sub.trialEndsAt,
        currentPeriodEnd: current.sub.currentPeriodEnd,
        entitlements: await entitlementsFor(current.plan.id),
      };
      ctx.subscription = snapshot;
    }
  }
  return ctx;
}

export async function can(
  userId: string | null,
  feature: FeatureKey,
): Promise<EntitlementDecision> {
  return resolveEntitlement(feature, await loadEntitlementContext(userId));
}

export async function canUseProAccount(userId: string) {
  return proAccountAllowed(await loadEntitlementContext(userId));
}

function periodStart(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Current usage for limit/metered features. */
export async function currentUsage(userId: string, feature: FeatureKey): Promise<number> {
  const db = getDb();
  if (feature === FEATURES.LISTINGS_ACTIVE || feature === FEATURES.LISTINGS_FEATURED) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(
        and(
          or(eq(listings.agentId, userId), eq(listings.ownerId, userId)),
          inArray(listings.status, ["active", "coming_soon", "pending"]),
          feature === FEATURES.LISTINGS_FEATURED ? eq(listings.isFeatured, true) : undefined,
        ),
      );
    return row?.n ?? 0;
  }
  const [row] = await db
    .select({ q: usageCounters.quantity })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.featureKey, feature),
        eq(usageCounters.periodStart, periodStart()),
      ),
    );
  return row?.q ?? 0;
}

export class EntitlementError extends Error {
  constructor(public readonly decision: EntitlementDecision) {
    super(
      decision.reason === "disabled_globally"
        ? "This feature is currently turned off."
        : decision.allowed
          ? "You've reached your plan's limit for this feature."
          : "Your current plan doesn't include this feature.",
    );
    this.name = "EntitlementError";
  }
}

/** Throws EntitlementError when not allowed or over limit. */
export async function assertCan(userId: string | null, feature: FeatureKey, increment = 1) {
  const decision = await can(userId, feature);
  if (!decision.allowed) throw new EntitlementError(decision);
  if (decision.limit !== null && userId) {
    if (!withinLimit(decision, await currentUsage(userId, feature), increment))
      throw new EntitlementError(decision);
  }
  return decision;
}

/** Record metered usage (e.g. one AI request). */
export async function recordUsage(userId: string, feature: FeatureKey, quantity = 1) {
  await getDb()
    .insert(usageCounters)
    .values({ userId, featureKey: feature, periodStart: periodStart(), quantity })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.featureKey, usageCounters.periodStart],
      set: { quantity: sql`${usageCounters.quantity} + ${quantity}` },
    });
}
