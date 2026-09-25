import { describe, expect, it } from "vitest";
import {
  bucketFor,
  directionsUrl,
  median,
  pinPriceValue,
  priceCutoffs,
  type PriceBucket,
} from "./map-pricing";
import type { MapPin } from "@/providers/search/types";

function pin(price: number, sqft: number | null = null): MapPin {
  return {
    id: `${price}`,
    slug: `${price}`,
    lat: 0,
    lng: 0,
    price,
    listingType: "sale",
    status: "active",
    beds: 3,
    sqft,
    isFeatured: false,
  };
}

describe("pinPriceValue", () => {
  it("returns price in price mode", () => {
    expect(pinPriceValue(pin(500_000, 1000), "price")).toBe(500_000);
  });
  it("returns price per sqft in ppsf mode", () => {
    expect(pinPriceValue(pin(500_000, 1000), "ppsf")).toBe(500);
  });
  it("returns null in ppsf mode without sqft", () => {
    expect(pinPriceValue(pin(500_000, null), "ppsf")).toBeNull();
    expect(pinPriceValue(pin(500_000, 0), "ppsf")).toBeNull();
  });
});

describe("priceCutoffs + bucketFor", () => {
  const values = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const { p33, p67 } = priceCutoffs(values);
  it("splits into thirds (nearest-rank)", () => {
    expect(p33).toBe(300);
    expect(p67).toBe(700);
  });
  it("buckets low/mid/high", () => {
    expect(bucketFor(100, p33, p67)).toBe("low");
    expect(bucketFor(300, p33, p67)).toBe("low");
    expect(bucketFor(450, p33, p67)).toBe("mid");
    expect(bucketFor(600, p33, p67)).toBe("mid");
    expect(bucketFor(700, p33, p67)).toBe("high");
    expect(bucketFor(900, p33, p67)).toBe("high");
  });
  it("marks missing values as na", () => {
    expect(bucketFor(null, p33, p67)).toBe("na");
    expect(bucketFor(NaN, p33, p67)).toBe("na");
  });
  it("degenerates to mid when everything costs the same", () => {
    const c = priceCutoffs([500, 500, 500]);
    const b: PriceBucket = bucketFor(500, c.p33, c.p67);
    expect(b).toBe("mid");
  });
});

describe("median", () => {
  it("handles odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("directionsUrl", () => {
  it("builds a Google Maps universal directions URL", () => {
    expect(directionsUrl(43.65, -79.38)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=43.65,-79.38",
    );
  });
});
