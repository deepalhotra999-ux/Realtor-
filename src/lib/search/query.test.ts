import { describe, expect, it } from "vitest";
import { activeFilterCount, parseSearchParams, toSearchParams } from "./query";

describe("search query", () => {
  it("parses URL params into a typed query with defaults", () => {
    const q = parseSearchParams(
      new URLSearchParams(
        "type=rent&beds=2&maxPrice=3000&types=condo,apartment&features=pool,gym&pets=1",
      ),
    );
    expect(q).toMatchObject({
      listingType: "rent",
      minBeds: 2,
      maxPrice: 3000,
      propertyTypes: ["condo", "apartment"],
      features: ["pool", "gym"],
      petsAllowed: true,
      sort: "relevance",
      page: 1,
    });
  });

  it("drops invalid values instead of throwing", () => {
    const q = parseSearchParams({
      type: "lease",
      beds: "lots",
      types: "castle,condo",
      bbox: "1,2,3",
      sort: "weird",
      features: "pool,moat",
    });
    expect(q.listingType).toBe("sale");
    expect(q.minBeds).toBeUndefined();
    expect(q.propertyTypes).toEqual(["condo"]);
    expect(q.features).toEqual(["pool"]);
    expect(q.bbox).toBeUndefined();
    expect(q.sort).toBe("relevance");
  });

  it("round-trips through toSearchParams", () => {
    const q = parseSearchParams(
      new URLSearchParams("beds=3&minPrice=400000&bbox=-97.8,30.2,-97.7,30.3&sort=newest&page=2"),
    );
    const again = parseSearchParams(toSearchParams(q));
    expect(again).toEqual(q);
    expect(toSearchParams({ listingType: "sale", sort: "relevance", page: 1 }).toString()).toBe("");
  });

  it("counts active filters", () => {
    expect(activeFilterCount(parseSearchParams({}))).toBe(0);
    expect(
      activeFilterCount(
        parseSearchParams({ beds: "2", minPrice: "1", maxPrice: "2", features: "pool,gym" }),
      ),
    ).toBe(4);
  });
});
