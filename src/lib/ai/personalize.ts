import type { PropertyType } from "@/lib/domain";
import type { ListingSummary } from "@/lib/listing-types";
import type { Preferences } from "./match";

/**
 * Personalized matching: infer preferences from the homes a user saved, then
 * let anything they stated explicitly win. Every inferred value is derived
 * from saved listings, so it can be explained ("based on 6 saved homes").
 */

function median(ns: number[]) {
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function roundPrice(n: number, rent: boolean) {
  const step = rent ? 50 : 5_000;
  return Math.round(n / step) * step;
}

const KM_PER_DEG = 111;

export function inferPreferences(saved: ListingSummary[]): Preferences {
  if (saved.length === 0) return {};
  const rentCount = saved.filter((s) => s.listingType === "rent").length;
  const listingType = rentCount > saved.length / 2 ? "rent" : "sale";
  const pool = saved.filter((s) => s.listingType === listingType);
  const rent = listingType === "rent";

  const prices = pool.map((s) => s.price);
  const mid = median(prices);
  const prefs: Preferences = {
    listingType,
    minPrice: roundPrice(Math.min(...prices) * 0.85, rent),
    maxPrice: roundPrice(Math.max(mid * 1.25, Math.max(...prices) * 1.05), rent),
  };

  const beds = pool.map((s) => s.beds).filter((b): b is number => b !== null);
  if (beds.length) prefs.minBeds = Math.min(...beds);

  // Property types seen in at least a third of saves.
  const typeCounts = new Map<PropertyType, number>();
  for (const s of pool) typeCounts.set(s.propertyType, (typeCounts.get(s.propertyType) ?? 0) + 1);
  const types = [...typeCounts].filter(([, n]) => n >= pool.length / 3).map(([t]) => t);
  if (types.length) prefs.propertyTypes = types;

  // Amenities present in at least half of saves (needs 2+ saves to mean anything).
  if (pool.length >= 2) {
    const featureCounts = new Map<string, number>();
    for (const s of pool)
      for (const f of s.features) featureCounts.set(f, (featureCounts.get(f) ?? 0) + 1);
    const common = [...featureCounts]
      .filter(([, n]) => n >= pool.length / 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([f]) => f);
    if (common.length) prefs.features = common;
  }

  // A location centre only when saves cluster (within ~30 km of their centroid).
  const lat = pool.reduce((a, s) => a + s.latitude, 0) / pool.length;
  const lng = pool.reduce((a, s) => a + s.longitude, 0) / pool.length;
  const spreadKm = Math.max(
    ...pool.map((s) =>
      Math.hypot(
        (s.latitude - lat) * KM_PER_DEG,
        (s.longitude - lng) * KM_PER_DEG * Math.cos((lat * Math.PI) / 180),
      ),
    ),
  );
  if (spreadKm <= 30) {
    const cities = new Map<string, number>();
    for (const s of pool) cities.set(s.city, (cities.get(s.city) ?? 0) + 1);
    const topCity = [...cities].sort((a, b) => b[1] - a[1])[0]?.[0];
    prefs.center = { lat, lng, label: topCity };
  }
  return prefs;
}

/** Explicit preferences win field by field; inferred values fill the gaps. */
export function mergePreferences(explicit: Preferences, inferred: Preferences): Preferences {
  const out: Preferences = { ...inferred };
  for (const [k, v] of Object.entries(explicit) as [keyof Preferences, unknown][]) {
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  // A different explicit listing type makes inferred prices meaningless.
  if (
    explicit.listingType &&
    inferred.listingType &&
    explicit.listingType !== inferred.listingType
  ) {
    if (explicit.minPrice === undefined) delete out.minPrice;
    if (explicit.maxPrice === undefined) delete out.maxPrice;
  }
  return out;
}
