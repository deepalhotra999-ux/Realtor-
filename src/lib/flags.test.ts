import { describe, expect, it } from "vitest";
import { evaluateFlag, rolloutBucket } from "./flags";

const flag = { key: "x", enabled: true, rolloutPercent: 100, roles: [] as string[] };

describe("evaluateFlag", () => {
  it("handles missing and disabled flags", () => {
    expect(evaluateFlag(undefined)).toBe(false);
    expect(evaluateFlag({ ...flag, enabled: false })).toBe(false);
    expect(evaluateFlag(flag)).toBe(true);
  });

  it("targets roles", () => {
    const f = { ...flag, roles: ["agent"] };
    expect(evaluateFlag(f, { id: "u1", role: "consumer" })).toBe(false);
    expect(evaluateFlag(f, { id: "u1", role: "agent" })).toBe(true);
  });

  it("buckets users deterministically for partial rollouts", () => {
    const f = { ...flag, rolloutPercent: 50 };
    const ids = Array.from({ length: 400 }, (_, i) => `user-${i}`);
    const on = ids.filter((id) => evaluateFlag(f, { id })).length;
    expect(on).toBeGreaterThan(140);
    expect(on).toBeLessThan(260);
    expect(evaluateFlag(f, { id: "user-7" })).toBe(evaluateFlag(f, { id: "user-7" }));
    expect(rolloutBucket("x", "a")).toBeGreaterThanOrEqual(0);
    expect(evaluateFlag(f, {})).toBe(false);
  });
});
