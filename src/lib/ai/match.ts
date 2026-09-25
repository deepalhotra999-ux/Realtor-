import { AMENITIES, PROPERTY_TYPE_LABELS, type AmenityKey, type PropertyType } from "@/lib/domain";
import { formatCompactPrice } from "@/lib/format";
import { haversineKm } from "@/lib/geo/places";
import type { ListingSummary } from "@/lib/listing-types";

/**
 * Transparent, explainable match scoring for the AI Home Finder and
 * personalized recommendations. Every point comes from a stated rule, and
 * every reason shown to a user is derived from listing facts.
 */

export interface Preferences {
  listingType?: "sale" | "rent";
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  minSqft?: number;
  propertyTypes?: PropertyType[];
  features?: string[];
  petsAllowed?: boolean;
  center?: { lat: number; lng: number; label?: string };
}

export interface MatchResult {
  score: number;
  reasons: string[];
  tradeoffs: string[];
}

const WEIGHTS = { price: 30, beds: 15, baths: 8, type: 12, features: 20, size: 8, location: 7 };

export function scoreListing(l: ListingSummary, prefs: Preferences): MatchResult {
  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];
  const tradeoffs: string[] = [];
  const priceLabel = (n: number) => formatCompactPrice(n, l.listingType);

  if (prefs.maxPrice !== undefined || prefs.minPrice !== undefined) {
    possible += WEIGHTS.price;
    const max = prefs.maxPrice ?? Infinity;
    if (l.price <= max && l.price >= (prefs.minPrice ?? 0)) {
      earned += WEIGHTS.price;
      if (prefs.maxPrice !== undefined) {
        const under = prefs.maxPrice - l.price;
        reasons.push(
          under > prefs.maxPrice * 0.08
            ? `${priceLabel(under)} under your budget`
            : "Within your budget",
        );
      }
    } else if (l.price > max) {
      const over = (l.price - max) / max;
      earned += Math.max(0, WEIGHTS.price * (1 - over * 5));
      tradeoffs.push(`${priceLabel(l.price - max)} over budget`);
    } else {
      earned += WEIGHTS.price * 0.6;
    }
  }

  if (prefs.minBeds !== undefined) {
    possible += WEIGHTS.beds;
    if ((l.beds ?? 0) >= prefs.minBeds) {
      earned += WEIGHTS.beds;
      const extra = (l.beds ?? 0) - prefs.minBeds;
      reasons.push(
        extra > 0 ? `${l.beds} bedrooms (${extra} more than you asked for)` : `${l.beds} bedrooms`,
      );
    } else tradeoffs.push(`${l.beds ?? 0} bedrooms (you wanted ${prefs.minBeds})`);
  }

  if (prefs.minBaths !== undefined) {
    possible += WEIGHTS.baths;
    if ((l.baths ?? 0) >= prefs.minBaths) earned += WEIGHTS.baths;
    else tradeoffs.push(`${l.baths ?? 0} baths (you wanted ${prefs.minBaths})`);
  }

  if (prefs.propertyTypes?.length) {
    possible += WEIGHTS.type;
    if (prefs.propertyTypes.includes(l.propertyType)) earned += WEIGHTS.type;
    else tradeoffs.push(`It's a ${PROPERTY_TYPE_LABELS[l.propertyType].toLowerCase()}`);
  }

  if (prefs.features?.length) {
    possible += WEIGHTS.features;
    const have = prefs.features.filter((f) => l.features.includes(f));
    earned += WEIGHTS.features * (have.length / prefs.features.length);
    if (have.length)
      reasons.push(
        `Has ${have.map((f) => AMENITIES[f as AmenityKey]?.toLowerCase() ?? f).join(", ")}`,
      );
    const missing = prefs.features.filter((f) => !l.features.includes(f));
    if (missing.length)
      tradeoffs.push(
        `No ${missing.map((f) => AMENITIES[f as AmenityKey]?.toLowerCase() ?? f).join(" or ")} listed`,
      );
  }

  if (prefs.minSqft !== undefined) {
    possible += WEIGHTS.size;
    if ((l.sqft ?? 0) >= prefs.minSqft) {
      earned += WEIGHTS.size;
      reasons.push(`${l.sqft?.toLocaleString("en-US")} sqft`);
    } else if (l.sqft) {
      earned += WEIGHTS.size * (l.sqft / prefs.minSqft) * 0.6;
      tradeoffs.push(`${l.sqft.toLocaleString("en-US")} sqft`);
    }
  }

  if (prefs.center) {
    possible += WEIGHTS.location;
    const km = haversineKm(prefs.center, { lat: l.latitude, lng: l.longitude });
    earned += WEIGHTS.location * Math.max(0, 1 - km / 15);
    const miles = km * 0.621371;
    if (miles < 1.5)
      reasons.push(
        prefs.center.label ? `In the heart of ${prefs.center.label}` : "Right where you're looking",
      );
    else if (miles > 8)
      tradeoffs.push(`${miles.toFixed(0)} mi from ${prefs.center.label ?? "your area"}`);
  }

  if (prefs.petsAllowed) {
    possible += 5;
    if (l.listingType === "sale" || l.features.includes("fenced_yard")) earned += 5;
  }

  if (l.priceCut) reasons.push(`Price reduced by ${priceLabel(l.priceCut)}`);
  if (l.nextOpenHouse) reasons.push("Open house coming up");

  const score = possible ? Math.round((earned / possible) * 100) : 50;
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.slice(0, 4),
    tradeoffs: tradeoffs.slice(0, 3),
  };
}

export function rankListings(listings: ListingSummary[], prefs: Preferences) {
  return listings
    .map((l) => ({ listing: l, match: scoreListing(l, prefs) }))
    .sort((a, b) => b.match.score - a.match.score || a.listing.price - b.listing.price);
}
