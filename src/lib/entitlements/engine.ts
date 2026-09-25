import type { MonetizationSettings } from "@/lib/settings-schema";
import { FEATURES, type FeatureKey } from "./catalog";

/**
 * Pure entitlement resolution: Plans → Entitlements → Features.
 *
 * No plan names, prices or feature rules are hard-coded here. The decision is
 * derived entirely from admin settings plus the data-driven plan the subject is
 * on. Keeping it pure makes it trivially testable and reusable from server
 * actions, route handlers and background jobs.
 */

export interface EntitlementGrant {
  enabled: boolean;
  /** null = unlimited (or not applicable for boolean features). */
  limit: number | null;
}

export type EntitlementMap = Record<string, EntitlementGrant>;

export interface SubscriptionSnapshot {
  planKey: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  entitlements: EntitlementMap;
}

export interface EntitlementContext {
  settings: MonetizationSettings;
  /** Extra free-mode allowances by feature key (e.g. AI requests per month). */
  freeAllowances?: Record<string, number | null>;
  subscription: SubscriptionSnapshot | null;
  /** Entitlements of the plan flagged `isDefault`, used when a subject has no subscription. */
  defaultPlan: { key: string; entitlements: EntitlementMap } | null;
  now?: Date;
}

export type DecisionReason =
  | "disabled_globally"
  | "free_mode"
  | "free_feature"
  | "plan"
  | "trial"
  | "default_plan"
  | "free_allowance"
  | "not_entitled";

export interface EntitlementDecision {
  feature: string;
  allowed: boolean;
  /** Effective cap. null = unlimited. */
  limit: number | null;
  reason: DecisionReason;
  planKey?: string;
}

/** Features switched off platform-wide regardless of plan. */
export function globallyDisabled(feature: string, settings: MonetizationSettings): boolean {
  if (!settings.aiFeaturesEnabled && feature.startsWith("ai.")) return true;
  if (!settings.featuredListingsEnabled && feature === FEATURES.LISTINGS_FEATURED) return true;
  if (!settings.advertisingEnabled && feature === FEATURES.ADS) return true;
  return false;
}

/** Whether a subscription currently confers its plan's entitlements. */
export function isSubscriptionEffective(sub: SubscriptionSnapshot, now: Date): boolean {
  switch (sub.status) {
    case "trialing":
      return sub.trialEndsAt !== null && sub.trialEndsAt > now;
    case "active":
    case "past_due": // grace period until the period ends
    case "canceled": // cancelled subscriptions run to the end of the paid period
      return sub.currentPeriodEnd > now;
    case "expired":
      return false;
  }
}

function freeAllowance(feature: string, ctx: EntitlementContext): number | null | undefined {
  if (feature === FEATURES.LISTINGS_ACTIVE) return ctx.settings.freeListingsLimit;
  return ctx.freeAllowances?.[feature];
}

export function resolveEntitlement(
  feature: FeatureKey,
  ctx: EntitlementContext,
): EntitlementDecision {
  const now = ctx.now ?? new Date();
  const { settings } = ctx;

  if (globallyDisabled(feature, settings)) {
    return { feature, allowed: false, limit: 0, reason: "disabled_globally" };
  }

  // Subscription system OFF → everything is free; only admin-configured free
  // allowances (e.g. "Free Listings") apply.
  if (!settings.subscriptionsEnabled) {
    const allowance = freeAllowance(feature, ctx);
    return { feature, allowed: allowance !== 0, limit: allowance ?? null, reason: "free_mode" };
  }

  // Subscription system ON, but this feature is not marked as paid → free.
  if (!settings.paidFeatures.includes(feature)) {
    const allowance = freeAllowance(feature, ctx);
    return { feature, allowed: allowance !== 0, limit: allowance ?? null, reason: "free_feature" };
  }

  // Paid feature: the subject's own subscription wins.
  const sub = ctx.subscription;
  if (sub && isSubscriptionEffective(sub, now)) {
    const grant = sub.entitlements[feature];
    if (grant?.enabled) {
      return {
        feature,
        allowed: grant.limit !== 0,
        limit: grant.limit,
        reason: sub.status === "trialing" ? "trial" : "plan",
        planKey: sub.planKey,
      };
    }
  }

  // Fall back to the default (free) plan.
  const fallback = ctx.defaultPlan?.entitlements[feature];
  if (fallback?.enabled) {
    return {
      feature,
      allowed: fallback.limit !== 0,
      limit: fallback.limit,
      reason: "default_plan",
      planKey: ctx.defaultPlan!.key,
    };
  }

  // Finally, an admin-configured free allowance (e.g. N free listings).
  const allowance = freeAllowance(feature, ctx);
  if (allowance !== undefined && allowance !== null && allowance > 0) {
    return { feature, allowed: true, limit: allowance, reason: "free_allowance" };
  }

  return { feature, allowed: false, limit: 0, reason: "not_entitled" };
}

/** Check a decision against current usage (for limit & metered features). */
export function withinLimit(decision: EntitlementDecision, currentUsage: number, increment = 1) {
  if (!decision.allowed) return false;
  if (decision.limit === null) return true;
  return currentUsage + increment <= decision.limit;
}

/** Pro accounts (agent/broker/PM) may require a plan when free agent accounts are OFF. */
export function proAccountAllowed(ctx: EntitlementContext): boolean {
  const { settings } = ctx;
  if (!settings.subscriptionsEnabled || settings.freeAgentAccounts) return true;
  const now = ctx.now ?? new Date();
  return ctx.subscription !== null && isSubscriptionEffective(ctx.subscription, now);
}

/** Trial length for a new subscription to a plan. 0 = no trial. */
export function trialDaysFor(planTrialDays: number, settings: MonetizationSettings): number {
  if (!settings.freeTrialEnabled) return 0;
  return planTrialDays > 0 ? planTrialDays : settings.trialDurationDays;
}
