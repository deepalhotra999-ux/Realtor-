import { describe, expect, it } from "vitest";
import { generateSeedListings, SeedPropertyDataProvider } from "./seed";
import { mapResoProperty, ResoWebApiProvider } from "./reso";
import { ProviderNotConfiguredError } from "./types";

describe("seed property data", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("is deterministic for a given seed", () => {
    const a = generateSeedListings({ count: 20, seed: 7, now });
    const b = generateSeedListings({ count: 20, seed: 7, now });
    expect(a).toEqual(b);
    expect(generateSeedListings({ count: 20, seed: 8, now })).not.toEqual(a);
  });

  it("produces internally consistent, clearly fictional records", () => {
    for (const r of generateSeedListings({ count: 200, seed: 1, now })) {
      expect(r.externalId).toMatch(/^DEMO-/);
      expect(r.listing.description).toMatch(/fictional/);
      expect(r.listing.price).toBeGreaterThan(0);
      expect(r.property.latitude).toBeGreaterThan(24);
      expect(r.property.longitude).toBeLessThan(-66);
      if (r.listing.listingType === "rent") expect(r.property.propertyType).not.toBe("land");
      if (r.property.garageSpaces) expect(r.property.features).toContain("garage");
      else expect(r.property.features).not.toContain("garage");
      expect(r.priceHistory[0]?.event).toBe("listed");
    }
  });

  it("paginates with cursors", async () => {
    const p = new SeedPropertyDataProvider({ count: 5, now });
    const first = await p.fetchPage(undefined, 3);
    expect(first.records).toHaveLength(3);
    const second = await p.fetchPage(first.nextCursor, 3);
    expect(second.records).toHaveLength(2);
    expect(second.nextCursor).toBeUndefined();
  });
});

describe("RESO Web API adapter", () => {
  it("maps RESO Data Dictionary fields", () => {
    const r = mapResoProperty({
      ListingKey: "MLS123",
      StandardStatus: "Active Under Contract",
      ListPrice: 500000,
      PropertyType: "Residential",
      PropertySubType: "Condominium",
      StreetNumber: "12",
      StreetName: "Main",
      StreetSuffix: "St",
      City: "Austin",
      StateOrProvince: "TX",
      PostalCode: "78701",
      Latitude: 30.27,
      Longitude: -97.74,
      BedroomsTotal: 2,
      BathroomsTotalDecimal: 2.5,
      LivingArea: 1234.4,
      Media: [
        { MediaURL: "b.jpg", Order: 2 },
        { MediaURL: "a.jpg", Order: 1 },
      ],
    });
    expect(r).toMatchObject({
      externalId: "MLS123",
      property: { propertyType: "condo", street: "12 Main St", sqft: 1234, baths: 2.5 },
      listing: { status: "pending", listingType: "sale", price: 500000 },
    });
    expect(r?.media.map((m) => m.url)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("refuses records missing data we must not invent", () => {
    expect(mapResoProperty({ ListingKey: "x", ListPrice: 1 })).toBeNull();
  });

  it("maps leases and throws a clear error when unconfigured", async () => {
    const lease = mapResoProperty({
      ListingKey: "L1",
      StandardStatus: "Closed",
      ListPrice: 2000,
      PropertyType: "Residential Lease",
      City: "X",
      StateOrProvince: "TX",
      Latitude: 30,
      Longitude: -97,
    });
    expect(lease?.listing).toMatchObject({ listingType: "rent", status: "rented" });
    await expect(new ResoWebApiProvider().fetchPage()).rejects.toBeInstanceOf(
      ProviderNotConfiguredError,
    );
  });
});
