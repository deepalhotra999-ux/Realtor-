import { describe, expect, it } from "vitest";
import { trustSettingsSchema } from "./settings-schema";
import {
  accountCapability,
  countLinks,
  limitsFor,
  limitTier,
  publishDecision,
  strikeStep,
  verificationLevel,
  withinLimit,
} from "./trust";

const s = trustSettingsSchema.parse({});
const facts = {
  role: "agent" as const,
  emailVerified: true,
  phoneVerified: false,
  identityApproved: true,
  licenseApproved: true,
};

describe("verification levels", () => {
  it("are cumulative", () => {
    expect(verificationLevel({ ...facts, emailVerified: false }, s)).toBe(0);
    expect(verificationLevel({ ...facts, identityApproved: false }, s)).toBe(1);
    expect(verificationLevel({ ...facts, licenseApproved: false }, s)).toBe(2);
    expect(verificationLevel(facts, s)).toBe(3);
  });

  it("never reach level 3 without a professional role", () => {
    expect(verificationLevel({ ...facts, role: "consumer" }, s)).toBe(2);
  });

  it("require a phone for level 1 when configured", () => {
    const phone = { ...s, requirePhoneForLevel1: true };
    expect(verificationLevel(facts, phone)).toBe(0);
    expect(verificationLevel({ ...facts, phoneVerified: true }, phone)).toBe(3);
  });
});

describe("badges", () => {
  it("only claim verification that actually happened", () => {
    expect(accountCapability("agent", 1)).toMatchObject({
      verified: false,
      label: "Agent (unverified)",
    });
    expect(accountCapability("agent", 3)).toMatchObject({ verified: true, key: "VERIFIED_AGENT" });
    expect(accountCapability("broker", 3).key).toBe("VERIFIED_BROKER");
    expect(accountCapability("consumer", 2)).toMatchObject({
      verified: true,
      key: "VERIFIED_SELLER",
    });
    expect(accountCapability("consumer", 1)).toMatchObject({ verified: false, key: "CONSUMER" });
  });
});

describe("publishing", () => {
  it("uses the configured level per account type", () => {
    expect(publishDecision("consumer", 1, s)).toEqual({
      allowed: false,
      reason: "level",
      requiredLevel: 2,
    });
    expect(publishDecision("consumer", 2, s)).toEqual({ allowed: true, needsReview: false });
    expect(publishDecision("agent", 0, s)).toMatchObject({ allowed: false });
    // Allowed at level 1 but below the review threshold (2) → reviewed first.
    expect(publishDecision("agent", 1, s)).toEqual({ allowed: true, needsReview: true });
    expect(publishDecision("agent", 3, s)).toEqual({ allowed: true, needsReview: false });
  });

  it("blocks private sellers entirely when seller listings are off", () => {
    expect(publishDecision("consumer", 3, { ...s, sellerListingsEnabled: false })).toMatchObject({
      allowed: false,
      reason: "role",
    });
  });
});

describe("new-account limits", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const old = new Date("2026-01-01T00:00:00Z");
  const fresh = new Date("2026-06-25T00:00:00Z");

  it("puts young or unverified accounts on probation and verified ones in the trusted tier", () => {
    expect(limitTier({ createdAt: fresh, level: 1, role: "consumer" }, s, now)).toBe("probation");
    expect(limitTier({ createdAt: old, level: 0, role: "consumer" }, s, now)).toBe("probation");
    expect(limitTier({ createdAt: old, level: 1, role: "consumer" }, s, now)).toBe("standard");
    expect(limitTier({ createdAt: fresh, level: 2, role: "consumer" }, s, now)).toBe("trusted");
    expect(limitsFor("probation", s).linksPerMessage).toBe(0);
  });

  it("treats null as unlimited", () => {
    expect(withinLimit(10_000, null)).toBe(true);
    expect(withinLimit(19, 20)).toBe(true);
    expect(withinLimit(20, 20)).toBe(false);
    expect(withinLimit(0, 0, 1)).toBe(false);
  });

  it("counts links, including bare domains", () => {
    expect(countLinks("see https://example.com and www.foo.org")).toBe(2);
    expect(countLinks("pay at scam-payments.xyz today")).toBe(1);
    expect(countLinks("3 beds, 2 baths. Lovely!")).toBe(0);
  });
});

describe("strike ladder", () => {
  it("applies the configured step at each threshold and repeats the top step", () => {
    expect(strikeStep(1, s.strikeLadder)?.action).toBe("warn");
    expect(strikeStep(2, s.strikeLadder)?.action).toBe("restrict");
    expect(strikeStep(3, s.strikeLadder)?.action).toBe("suspend");
    expect(strikeStep(4, s.strikeLadder)).toBeNull();
    expect(strikeStep(5, s.strikeLadder)?.action).toBe("ban");
    expect(strikeStep(9, s.strikeLadder)?.action).toBe("ban");
    expect(strikeStep(1, [])).toBeNull();
  });
});
