import { describe, expect, it } from "vitest";
import { detail, summary } from "./fixtures";
import { rankListings, scoreListing } from "./match";
import { answerPropertyQuestion } from "./property-qa";
import { compareListings } from "./compare";

const now = new Date("2026-06-01T00:00:00Z");

describe("scoreListing", () => {
  it("scores perfect matches at 100 with fact-based reasons", () => {
    const m = scoreListing(summary(), {
      maxPrice: 600_000,
      minBeds: 3,
      propertyTypes: ["single_family"],
      features: ["garage"],
    });
    expect(m.score).toBe(100);
    expect(m.reasons.join(" ")).toMatch(/under your budget/);
    expect(m.reasons.join(" ")).toMatch(/garage/);
    expect(m.tradeoffs).toEqual([]);
  });

  it("penalises and explains mismatches", () => {
    const m = scoreListing(summary({ price: 700_000, beds: 2 }), {
      maxPrice: 600_000,
      minBeds: 3,
      features: ["pool"],
    });
    expect(m.score).toBeLessThan(40);
    expect(m.tradeoffs.join(" ")).toMatch(/over budget/);
    expect(m.tradeoffs.join(" ")).toMatch(/2 bedrooms/);
    expect(m.tradeoffs.join(" ")).toMatch(/pool/);
  });

  it("ranks better matches first", () => {
    const ranked = rankListings([summary({ id: "a", beds: 2 }), summary({ id: "b", beds: 4 })], {
      minBeds: 3,
    });
    expect(ranked[0].listing.id).toBe("b");
  });
});

describe("answerPropertyQuestion", () => {
  const l = detail();
  const ask = (q: string) => answerPropertyQuestion(l, q, now);

  it("answers from facts with sources", () => {
    expect(ask("How much is it?").answer).toMatch(/\$500,000/);
    expect(ask("what are the taxes?")).toMatchObject({ grounded: true, sources: ["taxAnnual"] });
    expect(ask("Is there a fireplace?").answer).toMatch(/^Yes/);
    expect(ask("does it have a pool?").answer).toMatch(/isn't listed/);
    expect(ask("how many bedrooms").answer).toMatch(/3 bedrooms/);
    expect(ask("what kind of heating").answer).toMatch(/Heat pump/);
    expect(ask("has the price dropped?").answer).toMatch(/\$525,000/);
    expect(ask("when was it built").answer).toMatch(/1998/);
  });

  it("refuses to guess about things not in the data", () => {
    for (const q of [
      "Is the neighborhood safe?",
      "What's the commute to downtown?",
      "Is it a good investment?",
      "Are pets allowed?",
    ]) {
      const a = ask(q);
      expect(a.grounded).toBe(false);
      expect(a.answer).toMatch(/doesn't include|rather not guess/);
    }
  });
});

describe("compareListings", () => {
  it("computes differences and unique features", () => {
    const a = summary({
      id: "a",
      street: "1 A St",
      price: 400_000,
      sqft: 1600,
      yearBuilt: 1990,
      features: ["pool", "garage"],
    });
    const b = summary({
      id: "b",
      street: "2 B St",
      price: 520_000,
      sqft: 2600,
      yearBuilt: 2018,
      features: ["garage", "solar"],
    });
    const c = compareListings([a, b]);
    expect(c.bestPrice?.listingId).toBe("a");
    expect(c.bestValue?.listingId).toBe("b");
    expect(c.mostSpace?.listingId).toBe("b");
    expect(c.newest?.listingId).toBe("b");
    expect(c.uniqueFeatures).toEqual({ a: ["Pool"], b: ["Solar panels"] });
    expect(c.bullets[0]).toMatch(/1 A St is the most affordable/);
  });

  it("needs at least two homes", () => {
    expect(compareListings([summary()]).bullets).toEqual([]);
  });
});
