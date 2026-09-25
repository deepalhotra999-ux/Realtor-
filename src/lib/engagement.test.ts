import { describe, expect, it } from "vitest";
import { alertTitle, isAlertDue, newMatchesSince } from "./alerts";
import { inferPreferences, mergePreferences } from "./ai/personalize";
import { summary } from "./ai/fixtures";

describe("saved-search alert scheduling", () => {
  const now = new Date("2026-05-10T12:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it("never alerts when off, always on first run", () => {
    expect(isAlertDue("off", null, now)).toBe(false);
    expect(isAlertDue("daily", null, now)).toBe(true);
  });

  it("respects each frequency with slack for scheduler jitter", () => {
    expect(isAlertDue("instant", ago(0.1), now)).toBe(false);
    expect(isAlertDue("instant", ago(0.2), now)).toBe(true);
    expect(isAlertDue("daily", ago(22), now)).toBe(false);
    expect(isAlertDue("daily", ago(23.5), now)).toBe(true);
    expect(isAlertDue("weekly", ago(24 * 6), now)).toBe(false);
    expect(isAlertDue("weekly", ago(24 * 7 - 0.5), now)).toBe(true);
  });

  it("selects only listings published after the last alert, newest first", () => {
    const items = [
      { id: "a", listedAt: "2026-05-09T00:00:00Z" },
      { id: "b", listedAt: "2026-05-01T00:00:00Z" },
      { id: "c", listedAt: null },
      { id: "d", listedAt: "2026-05-10T00:00:00Z" },
    ];
    expect(newMatchesSince(items, new Date("2026-05-05T00:00:00Z")).map((i) => i.id)).toEqual([
      "d",
      "a",
    ]);
    expect(alertTitle("Austin condos", 1)).toBe("1 new home for “Austin condos”");
  });
});

describe("personalized preferences", () => {
  const saved = [
    summary({
      id: "1",
      price: 400_000,
      beds: 3,
      propertyType: "single_family",
      features: ["pool", "garage"],
      latitude: 30.27,
      longitude: -97.74,
      city: "Austin",
    }),
    summary({
      id: "2",
      price: 460_000,
      beds: 4,
      propertyType: "single_family",
      features: ["garage"],
      latitude: 30.3,
      longitude: -97.7,
      city: "Austin",
    }),
    summary({
      id: "3",
      price: 420_000,
      beds: 3,
      propertyType: "townhouse",
      features: ["garage", "patio"],
      latitude: 30.25,
      longitude: -97.76,
      city: "Austin",
    }),
  ];

  it("returns nothing without saved homes", () => {
    expect(inferPreferences([])).toEqual({});
  });

  it("infers type, budget band, beds, common amenities and a clustered centre", () => {
    const p = inferPreferences(saved);
    expect(p.listingType).toBe("sale");
    expect(p.minPrice).toBe(340_000);
    expect(p.maxPrice).toBe(525_000);
    expect(p.minBeds).toBe(3);
    expect(p.propertyTypes).toEqual(expect.arrayContaining(["single_family", "townhouse"]));
    expect(p.features).toEqual(["garage"]);
    expect(p.center?.label).toBe("Austin");
  });

  it("drops the centre when saves are far apart", () => {
    const spread = [
      ...saved,
      summary({ id: "4", price: 430_000, latitude: 32.78, longitude: -96.8, city: "Dallas" }),
    ];
    expect(inferPreferences(spread).center).toBeUndefined();
  });

  it("lets explicit preferences win and drops mismatched inferred prices", () => {
    const merged = mergePreferences({ maxPrice: 380_000, features: [] }, inferPreferences(saved));
    expect(merged.maxPrice).toBe(380_000);
    expect(merged.features).toEqual(["garage"]);
    const rent = mergePreferences({ listingType: "rent" }, inferPreferences(saved));
    expect(rent.listingType).toBe("rent");
    expect(rent.maxPrice).toBeUndefined();
    expect(rent.minPrice).toBeUndefined();
  });
});
