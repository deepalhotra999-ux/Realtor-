import { describe, expect, it } from "vitest";
import { looksLikeNaturalLanguage, parseMoney, parseNaturalLanguage } from "./nl-parser";

const now = new Date("2026-06-01T00:00:00Z");
const p = (s: string) => parseNaturalLanguage(s, now);

describe("parseMoney", () => {
  it("handles suffixes and separators", () => {
    expect(parseMoney("$500k")).toBe(500_000);
    expect(parseMoney("1.25m")).toBe(1_250_000);
    expect(parseMoney("850,000")).toBe(850_000);
    expect(parseMoney("2500")).toBe(2500);
    expect(parseMoney("lots")).toBeNull();
  });
});

describe("parseNaturalLanguage", () => {
  it("parses a typical buyer request", () => {
    const r = p("3 bed house under $650k in Austin with a pool and a home office");
    expect(r.filters).toMatchObject({
      minBeds: 3,
      maxPrice: 650_000,
      propertyTypes: ["single_family"],
      features: expect.arrayContaining(["pool", "home_office"]),
    });
    expect(r.placeText).toBe("austin");
    expect(r.confidence).toBeGreaterThan(0.6);
  });

  it("detects rentals from price and pets", () => {
    const r = p("pet friendly 2br apartment in capitol hill under 2800");
    expect(r.filters).toMatchObject({
      listingType: "rent",
      minBeds: 2,
      maxPrice: 2800,
      petsAllowed: true,
      propertyTypes: ["apartment"],
    });
    expect(r.placeText).toBe("capitol hill");
  });

  it("maps 'apartment' to condo when buying", () => {
    expect(p("buy a 2 bedroom apartment").filters.propertyTypes).toEqual(["condo"]);
  });

  it("parses ranges, around, size and age", () => {
    expect(p("between 400k and 600k").filters).toMatchObject({
      minPrice: 400_000,
      maxPrice: 600_000,
    });
    expect(p("400-600k townhome").filters).toMatchObject({
      minPrice: 400_000,
      maxPrice: 600_000,
      propertyTypes: ["townhouse"],
    });
    expect(p("around $1m").filters).toMatchObject({ minPrice: 900_000, maxPrice: 1_100_000 });
    expect(p("at least 2,000 sqft built after 2010").filters).toMatchObject({
      minSqft: 2000,
      minYearBuilt: 2010,
    });
    expect(p("new construction").filters.minYearBuilt).toBe(2023);
  });

  it("understands HOA and sort intent", () => {
    expect(p("cheapest condo with no hoa").filters).toMatchObject({ maxHoa: 0, sort: "price_asc" });
    expect(p("newest listings").filters.sort).toBe("newest");
  });

  it("does not treat numbers as places", () => {
    expect(p("homes in 2 bed range").placeText).toBeUndefined();
  });

  it("returns empty filters for gibberish with low confidence", () => {
    const r = p("blorp zibble");
    expect(r.filters).toEqual({});
    expect(r.confidence).toBe(0);
  });
});

describe("looksLikeNaturalLanguage", () => {
  it("separates sentences from place names", () => {
    expect(looksLikeNaturalLanguage("Austin, TX")).toBe(false);
    expect(looksLikeNaturalLanguage("Ballard")).toBe(false);
    expect(looksLikeNaturalLanguage("3 bed with pool")).toBe(true);
    expect(looksLikeNaturalLanguage("quiet home near a park for my family")).toBe(true);
  });
});
