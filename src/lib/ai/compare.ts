import { AMENITIES, type AmenityKey } from "@/lib/domain";
import { formatCompactPrice, formatNumber } from "@/lib/format";
import type { ListingSummary } from "@/lib/listing-types";

/**
 * Deterministic comparison: computes the differences that matter and turns
 * them into plain-language bullet points. An LLM may re-phrase these, but the
 * numbers always come from here.
 */

export interface ComparisonInsight {
  listingId: string;
  label: string;
}

export interface ComparisonSummary {
  bestPrice?: ComparisonInsight;
  bestValue?: ComparisonInsight;
  mostSpace?: ComparisonInsight;
  newest?: ComparisonInsight;
  lowestFees?: ComparisonInsight;
  uniqueFeatures: Record<string, string[]>;
  bullets: string[];
}

const short = (l: ListingSummary) => l.street;

function minBy<T>(arr: T[], fn: (x: T) => number | null) {
  let best: T | undefined;
  let bestV = Infinity;
  for (const x of arr) {
    const v = fn(x);
    if (v !== null && v < bestV) {
      bestV = v;
      best = x;
    }
  }
  return best;
}

export function compareListings(listings: ListingSummary[]): ComparisonSummary {
  const out: ComparisonSummary = { uniqueFeatures: {}, bullets: [] };
  if (listings.length < 2) return out;

  const cheapest = minBy(listings, (l) => l.price)!;
  const priciest = minBy(listings, (l) => -l.price)!;
  out.bestPrice = { listingId: cheapest.id, label: "Lowest price" };
  out.bullets.push(
    `${short(cheapest)} is the most affordable at ${formatCompactPrice(cheapest.price, cheapest.listingType)} — ${formatCompactPrice(priciest.price - cheapest.price, cheapest.listingType)} less than ${short(priciest)}.`,
  );

  const value = minBy(listings, (l) => (l.sqft ? l.price / l.sqft : null));
  if (value?.sqft) {
    out.bestValue = { listingId: value.id, label: "Best $/sqft" };
    if (value.id !== cheapest.id)
      out.bullets.push(
        `${short(value)} gives the most space for the money at $${Math.round(value.price / value.sqft)}/sqft.`,
      );
  }

  const biggest = minBy(listings, (l) => (l.sqft ? -l.sqft : null));
  const smallest = minBy(listings, (l) => l.sqft ?? null);
  if (biggest?.sqft && smallest?.sqft && biggest.id !== smallest.id) {
    out.mostSpace = { listingId: biggest.id, label: "Most space" };
    out.bullets.push(
      `${short(biggest)} is the largest at ${formatNumber(biggest.sqft)} sqft, ${formatNumber(biggest.sqft - smallest.sqft)} sqft more than ${short(smallest)}.`,
    );
  }

  const newest = minBy(listings, (l) => (l.yearBuilt ? -l.yearBuilt : null));
  const oldest = minBy(listings, (l) => l.yearBuilt ?? null);
  if (newest?.yearBuilt && oldest?.yearBuilt && newest.yearBuilt !== oldest.yearBuilt) {
    out.newest = { listingId: newest.id, label: "Newest build" };
    out.bullets.push(
      `${short(newest)} is the newest (built ${newest.yearBuilt}); ${short(oldest)} dates from ${oldest.yearBuilt}.`,
    );
  }

  const withFees = listings.filter((l) => l.listingType === "sale");
  if (withFees.length >= 2) {
    const low = minBy(withFees, (l) => l.hoaMonthly ?? 0)!;
    const high = minBy(withFees, (l) => -(l.hoaMonthly ?? 0))!;
    if ((high.hoaMonthly ?? 0) > (low.hoaMonthly ?? 0)) {
      out.lowestFees = { listingId: low.id, label: "Lowest HOA" };
      out.bullets.push(
        `HOA dues range from ${low.hoaMonthly ? `$${low.hoaMonthly}` : "none"} (${short(low)}) to $${high.hoaMonthly}/mo (${short(high)}).`,
      );
    }
  }

  for (const l of listings) {
    const others = new Set(listings.filter((o) => o.id !== l.id).flatMap((o) => o.features));
    const unique = l.features
      .filter((f) => !others.has(f))
      .map((f) => AMENITIES[f as AmenityKey] ?? f);
    out.uniqueFeatures[l.id] = unique;
    if (unique.length)
      out.bullets.push(
        `Only ${short(l)} lists ${unique
          .slice(0, 3)
          .map((u) => u.toLowerCase())
          .join(", ")}.`,
      );
  }
  return out;
}
