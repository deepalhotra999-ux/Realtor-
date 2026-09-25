import { describe, expect, it } from "vitest";
import { errorText, retryDelayMs, shouldRetry } from "./jobs";
import { diffState } from "@/server/audit";

describe("job retry policy", () => {
  it("backs off exponentially from 30s and caps at an hour", () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(4)).toBe(240_000);
    expect(retryDelayMs(20)).toBe(3_600_000);
  });

  it("retries until attempts reach the maximum", () => {
    expect(shouldRetry(1, 5)).toBe(true);
    expect(shouldRetry(4, 5)).toBe(true);
    expect(shouldRetry(5, 5)).toBe(false);
  });

  it("stores bounded error text", () => {
    expect(errorText(new Error("boom"))).toContain("boom");
    expect(errorText("x".repeat(5000)).length).toBe(2000);
  });
});

describe("audit state diff", () => {
  it("keeps only changed fields and serialises dates", () => {
    const d1 = new Date("2026-01-01T00:00:00Z");
    const d2 = new Date("2026-02-01T00:00:00Z");
    expect(
      diffState(
        { status: "active", until: d1, name: "A" },
        { status: "suspended", until: d2, name: "A" },
      ),
    ).toEqual({
      before: { status: "active", until: d1.toISOString() },
      after: { status: "suspended", until: d2.toISOString() },
    });
  });

  it("passes through when either side is missing", () => {
    expect(diffState(null, { a: 1 })).toEqual({ before: null, after: { a: 1 } });
  });
});
