import { describe, expect, it } from "vitest";
import { monetizationSettingsSchema, type MonetizationSettings } from "@/lib/settings-schema";
import { FEATURES } from "./catalog";
import {
  proAccountAllowed,
  resolveEntitlement,
  trialDaysFor,
  withinLimit,
  type EntitlementContext,
  type SubscriptionSnapshot,
} from "./engine";

const now = new Date("2026-06-01T00:00:00Z");
const future = new Date("2026-07-01T00:00:00Z");
const past = new Date("2026-05-01T00:00:00Z");

function ctx(
  overrides: Omit<Partial<EntitlementContext>, "settings"> & {
    settings?: Partial<MonetizationSettings>;
  } = {},
): EntitlementContext {
  return {
    subscription: null,
    defaultPlan: null,
    now,
    ...overrides,
    settings: monetizationSettingsSchema.parse(overrides.settings ?? {}),
  };
}

const proSub = (patch: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  planKey: "pro",
  status: "active",
  trialEndsAt: null,
  currentPeriodEnd: future,
  entitlements: {
    [FEATURES.CRM]: { enabled: true, limit: null },
    [FEATURES.LISTINGS_ACTIVE]: { enabled: true, limit: 50 },
  },
  ...patch,
});

describe("resolveEntitlement", () => {
  it("allows everything with no limits when subscriptions are OFF (default)", () => {
    const d = resolveEntitlement(FEATURES.CRM, ctx());
    expect(d).toMatchObject({ allowed: true, limit: null, reason: "free_mode" });
  });

  it("applies the free listings allowance in free mode", () => {
    const d = resolveEntitlement(
      FEATURES.LISTINGS_ACTIVE,
      ctx({ settings: { freeListingsLimit: 3 } }),
    );
    expect(d).toMatchObject({ allowed: true, limit: 3, reason: "free_mode" });
  });

  it("honours global kill switches even in free mode", () => {
    const d = resolveEntitlement(
      FEATURES.AI_REQUESTS,
      ctx({ settings: { aiFeaturesEnabled: false } }),
    );
    expect(d).toMatchObject({ allowed: false, reason: "disabled_globally" });
    const f = resolveEntitlement(
      FEATURES.LISTINGS_FEATURED,
      ctx({ settings: { featuredListingsEnabled: false } }),
    );
    expect(f.allowed).toBe(false);
  });

  it("keeps non-paid features free when subscriptions are ON", () => {
    const d = resolveEntitlement(
      FEATURES.MESSAGING,
      ctx({ settings: { subscriptionsEnabled: true, paidFeatures: [FEATURES.CRM] } }),
    );
    expect(d).toMatchObject({ allowed: true, reason: "free_feature" });
  });

  it("denies paid features without a subscription or default plan", () => {
    const d = resolveEntitlement(
      FEATURES.CRM,
      ctx({ settings: { subscriptionsEnabled: true, paidFeatures: [FEATURES.CRM] } }),
    );
    expect(d).toMatchObject({ allowed: false, reason: "not_entitled" });
  });

  it("grants paid features from an active plan with its limits", () => {
    const settings = {
      subscriptionsEnabled: true,
      paidFeatures: [FEATURES.CRM, FEATURES.LISTINGS_ACTIVE],
    };
    const d = resolveEntitlement(
      FEATURES.LISTINGS_ACTIVE,
      ctx({ settings, subscription: proSub() }),
    );
    expect(d).toMatchObject({ allowed: true, limit: 50, reason: "plan", planKey: "pro" });
  });

  it("treats an unexpired trial as entitled and an expired trial as not", () => {
    const settings = { subscriptionsEnabled: true, paidFeatures: [FEATURES.CRM] };
    const trial = resolveEntitlement(
      FEATURES.CRM,
      ctx({ settings, subscription: proSub({ status: "trialing", trialEndsAt: future }) }),
    );
    expect(trial.reason).toBe("trial");
    const expired = resolveEntitlement(
      FEATURES.CRM,
      ctx({ settings, subscription: proSub({ status: "trialing", trialEndsAt: past }) }),
    );
    expect(expired.allowed).toBe(false);
  });

  it("runs cancelled subscriptions to the end of the paid period", () => {
    const settings = { subscriptionsEnabled: true, paidFeatures: [FEATURES.CRM] };
    expect(
      resolveEntitlement(
        FEATURES.CRM,
        ctx({ settings, subscription: proSub({ status: "canceled" }) }),
      ).allowed,
    ).toBe(true);
    expect(
      resolveEntitlement(
        FEATURES.CRM,
        ctx({ settings, subscription: proSub({ status: "canceled", currentPeriodEnd: past }) }),
      ).allowed,
    ).toBe(false);
  });

  it("falls back to the default plan, then to the free allowance", () => {
    const settings = {
      subscriptionsEnabled: true,
      paidFeatures: [FEATURES.LISTINGS_ACTIVE],
      freeListingsLimit: 2,
    };
    const viaDefault = resolveEntitlement(
      FEATURES.LISTINGS_ACTIVE,
      ctx({
        settings,
        defaultPlan: {
          key: "free",
          entitlements: { [FEATURES.LISTINGS_ACTIVE]: { enabled: true, limit: 5 } },
        },
      }),
    );
    expect(viaDefault).toMatchObject({ limit: 5, reason: "default_plan" });
    const viaAllowance = resolveEntitlement(FEATURES.LISTINGS_ACTIVE, ctx({ settings }));
    expect(viaAllowance).toMatchObject({ allowed: true, limit: 2, reason: "free_allowance" });
  });
});

describe("withinLimit", () => {
  it("respects unlimited and capped decisions", () => {
    const unlimited = resolveEntitlement(FEATURES.CRM, ctx());
    expect(withinLimit(unlimited, 10_000)).toBe(true);
    const capped = resolveEntitlement(
      FEATURES.LISTINGS_ACTIVE,
      ctx({ settings: { freeListingsLimit: 3 } }),
    );
    expect(withinLimit(capped, 2)).toBe(true);
    expect(withinLimit(capped, 3)).toBe(false);
  });
});

describe("proAccountAllowed / trialDaysFor", () => {
  it("only requires a plan for pro accounts when configured", () => {
    expect(proAccountAllowed(ctx())).toBe(true);
    expect(
      proAccountAllowed(
        ctx({ settings: { subscriptionsEnabled: true, freeAgentAccounts: false } }),
      ),
    ).toBe(false);
    expect(
      proAccountAllowed(
        ctx({
          settings: { subscriptionsEnabled: true, freeAgentAccounts: false },
          subscription: proSub(),
        }),
      ),
    ).toBe(true);
  });

  it("derives trial length from plan, settings and the trial switch", () => {
    const s = monetizationSettingsSchema.parse({ trialDurationDays: 14 });
    expect(trialDaysFor(30, s)).toBe(30);
    expect(trialDaysFor(0, s)).toBe(14);
    expect(trialDaysFor(30, { ...s, freeTrialEnabled: false })).toBe(0);
  });
});
