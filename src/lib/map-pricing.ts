import type { MapPin } from "@/providers/search/types";

/** How pins are colored on the map: absolute price or price per sqft. */
export type PinPriceMode = "price" | "ppsf";

/** Relative price bucket of a pin within the visible set. */
export type PriceBucket = "low" | "mid" | "high" | "na";

const BUCKET_COLORS: Record<PriceBucket, string> = {
  low: "#15803d", // green-700 — cheaper than most of what's on screen
  mid: "#b45309", // amber-700 — around the middle
  high: "#b91c1c", // red-700 — pricier than most of what's on screen
  na: "#6b7280", // gray-500 — no data for this mode
};

export const PRICE_BUCKET_LABELS: Record<PriceBucket, string> = {
  low: "Lower price",
  mid: "Typical price",
  high: "Higher price",
  na: "No data",
};

export function bucketColor(bucket: PriceBucket): string {
  return BUCKET_COLORS[bucket];
}

/** Numeric value a pin contributes in the given coloring mode (null = no data). */
export function pinPriceValue(pin: MapPin, mode: PinPriceMode): number | null {
  if (mode === "ppsf") {
    return pin.sqft && pin.sqft > 0 ? pin.price / pin.sqft : null;
  }
  return pin.price;
}

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx];
}

/** 33rd/67th percentile cutoffs that split values into low/mid/high thirds. */
export function priceCutoffs(values: number[]): { p33: number; p67: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return { p33: percentile(sorted, 33), p67: percentile(sorted, 67) };
}

export function bucketFor(
  value: number | null,
  p33: number,
  p67: number,
): PriceBucket {
  if (value === null || Number.isNaN(value)) return "na";
  if (p67 <= p33) return "mid"; // degenerate: every pin costs the same
  if (value <= p33) return "low";
  if (value >= p67) return "high";
  return "mid";
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Google Maps universal directions URL for a coordinate (opens the native app on mobile). */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
