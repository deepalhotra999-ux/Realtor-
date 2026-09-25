import { describe, expect, it } from "vitest";
import { addInterval, annualSavingsPct, priceFor } from "./billing";
import { draftFollowUp, followUpDaysFor, isClosed } from "./crm";
import { draftListingDescription } from "./ai/listing-writer";
import { numbersGrounded } from "./ai/grounding";

describe("numeric grounding guard", () => {
  it("accepts rewrites that reuse known figures", () => {
    expect(numbersGrounded("A 1,850 sqft home with 3 beds", "sqft 1850, beds 3")).toBe(true);
    expect(numbersGrounded("2.5 baths", "baths: 2.5")).toBe(true);
    expect(numbersGrounded("No numbers at all", "")).toBe(true);
  });

  it("rejects invented figures", () => {
    expect(numbersGrounded("Only 5 minutes to downtown", "beds 3")).toBe(false);
    expect(numbersGrounded("Priced at $499,000", "price 489000")).toBe(false);
  });
});

describe("billing periods", () => {
  it("adds months and clamps to the end of shorter months", () => {
    expect(addInterval(new Date("2026-01-31T12:00:00Z"), "month").toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
    expect(addInterval(new Date("2028-01-31T00:00:00Z"), "month").toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
    expect(addInterval(new Date("2026-03-15T00:00:00Z"), "month").toISOString()).toBe(
      "2026-04-15T00:00:00.000Z",
    );
  });

  it("adds years, handling leap days", () => {
    expect(addInterval(new Date("2028-02-29T00:00:00Z"), "year").toISOString()).toBe(
      "2029-02-28T00:00:00.000Z",
    );
  });

  it("prices by interval and computes annual savings", () => {
    const plan = { priceMonthly: 4900, priceAnnual: 49000 };
    expect(priceFor(plan, "month")).toBe(4900);
    expect(priceFor(plan, "year")).toBe(49000);
    expect(annualSavingsPct(plan)).toBe(17);
    expect(annualSavingsPct({ priceMonthly: 1000, priceAnnual: 12000 })).toBe(0);
    expect(annualSavingsPct({ priceMonthly: 0, priceAnnual: 0 })).toBe(0);
  });
});

describe("CRM helpers", () => {
  it("knows closed stages and follow-up cadence", () => {
    expect(isClosed("closed_won")).toBe(true);
    expect(isClosed("offer")).toBe(false);
    expect(followUpDaysFor("new")).toBe(1);
    expect(followUpDaysFor("closed_lost")).toBeNull();
  });

  it("drafts a follow-up from CRM facts only", () => {
    const text = draftFollowUp(
      {
        name: "Jordan Lee",
        stage: "new",
        intent: "sale",
        message: "Is it still available?",
        listingTitle: "Sunny bungalow",
        lastContactAt: null,
      },
      "Sam Agent",
    );
    expect(text).toMatch(/^Hi Jordan,/);
    expect(text).toContain("“Sunny bungalow”");
    expect(text).toMatch(/Sam Agent$/);
  });

  it("acknowledges a long silence", () => {
    const now = new Date("2026-06-20T00:00:00Z");
    const text = draftFollowUp(
      {
        name: "Ana",
        stage: "qualified",
        intent: "rent",
        message: null,
        listingTitle: null,
        lastContactAt: new Date("2026-06-01T00:00:00Z"),
      },
      "Sam",
      now,
    );
    expect(text).toContain("it's been a little while");
    expect(text).toContain("rental search");
  });
});

describe("listing writer", () => {
  it("uses only the supplied facts", () => {
    const text = draftListingDescription({
      listingType: "sale",
      propertyType: "single_family",
      city: "Austin",
      state: "TX",
      neighborhood: "Zilker",
      beds: 3,
      baths: 2.5,
      sqft: 1850,
      lotSqft: 21780,
      yearBuilt: 1998,
      garageSpaces: 2,
      features: ["pool", "fireplace", "not_a_real_amenity"],
    });
    expect(text).toContain("a 3-bedroom, 2.5-bath house in Zilker, Austin, TX.");
    expect(text).toContain(
      "It offers 1,850 square feet of living space, was built in 1998 and sits on 0.50 acres.",
    );
    expect(text).toContain("pool and fireplace");
    expect(text).toContain("a 2-car garage");
    expect(text).not.toContain("not_a_real_amenity");
  });

  it("describes rental terms without inventing any", () => {
    const text = draftListingDescription({
      listingType: "rent",
      propertyType: "apartment",
      city: "Denver",
      state: "CO",
      beds: 1,
      features: [],
      petsAllowed: true,
    });
    expect(text).toMatch(/^Available for rent: a 1-bedroom apartment in Denver, CO\./);
    expect(text).toContain("pets are welcome");
    expect(text).not.toContain("square feet");
  });
});
