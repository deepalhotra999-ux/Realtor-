import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { features, payments, planEntitlements, plans } from "@/server/db/schema";
import { can, currentUsage, getCurrentSubscription } from "@/server/entitlements";
import { FEATURES } from "@/lib/entitlements/catalog";

export async function listMyPayments(userId: string) {
  return getDb()
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(24);
}

/** Public, active plans with the names of the features each one grants. */
export async function listPublicPlans() {
  const db = getDb();
  const [planRows, ents] = await Promise.all([
    db
      .select()
      .from(plans)
      .where(and(eq(plans.isActive, true), eq(plans.isPublic, true)))
      .orderBy(asc(plans.sortOrder), asc(plans.priceMonthly)),
    db
      .select({
        planId: planEntitlements.planId,
        enabled: planEntitlements.enabled,
        limit: planEntitlements.limitValue,
        key: features.key,
        name: features.name,
        kind: features.kind,
        unit: features.unit,
        sortOrder: features.sortOrder,
      })
      .from(planEntitlements)
      .innerJoin(features, eq(features.key, planEntitlements.featureKey))
      .orderBy(asc(features.sortOrder)),
  ]);
  return planRows.map((p) => ({
    ...p,
    grants: ents
      .filter((e) => e.planId === p.id && e.enabled)
      .map((e) => ({
        key: e.key,
        label:
          e.kind === "boolean"
            ? e.name
            : e.limit === null
              ? `Unlimited ${e.unit ?? e.name.toLowerCase()}`
              : `${e.limit.toLocaleString("en-US")} ${e.unit ?? e.name.toLowerCase()}${e.kind === "metered" ? "/mo" : ""}`,
      })),
  }));
}

/** Usage meters shown on the billing page. */
export async function getUsageSummary(userId: string) {
  const keys = [FEATURES.LISTINGS_ACTIVE, FEATURES.LISTINGS_FEATURED, FEATURES.AI_REQUESTS];
  const labels: Record<string, string> = {
    [FEATURES.LISTINGS_ACTIVE]: "Active listings",
    [FEATURES.LISTINGS_FEATURED]: "Featured listings",
    [FEATURES.AI_REQUESTS]: "AI requests this month",
  };
  return Promise.all(
    keys.map(async (key) => {
      const [decision, used] = await Promise.all([can(userId, key), currentUsage(userId, key)]);
      return { key, label: labels[key], used, limit: decision.limit, allowed: decision.allowed };
    }),
  );
}

export { getCurrentSubscription };
