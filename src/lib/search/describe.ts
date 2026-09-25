import { AMENITIES, PROPERTY_TYPE_LABELS, type AmenityKey } from "@/lib/domain";
import { formatCompactPrice } from "@/lib/format";
import type { SearchQuery } from "./query";

/** Human-readable chips for a search query (saved searches, alerts, emails). */
export function describeQuery(q: Partial<SearchQuery>): string[] {
  const out: string[] = [q.listingType === "rent" ? "For rent" : "For sale"];
  if (q.city) out.push(`${q.city}${q.state ? `, ${q.state}` : ""}`);
  else if (q.bbox) out.push("Map area");
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    const f = (n: number) => formatCompactPrice(n, q.listingType);
    out.push(
      q.minPrice !== undefined && q.maxPrice !== undefined
        ? `${f(q.minPrice)}–${f(q.maxPrice)}`
        : q.maxPrice !== undefined
          ? `Up to ${f(q.maxPrice)}`
          : `${f(q.minPrice!)}+`,
    );
  }
  if (q.minBeds !== undefined) out.push(q.minBeds === 0 ? "Studio+" : `${q.minBeds}+ beds`);
  if (q.minBaths !== undefined) out.push(`${q.minBaths}+ baths`);
  if (q.propertyTypes?.length)
    out.push(q.propertyTypes.map((t) => PROPERTY_TYPE_LABELS[t]).join(" / "));
  if (q.minSqft) out.push(`${q.minSqft.toLocaleString("en-US")}+ sqft`);
  if (q.minYearBuilt) out.push(`Built ${q.minYearBuilt}+`);
  if (q.maxHoa !== undefined) out.push(q.maxHoa === 0 ? "No HOA" : `HOA ≤ $${q.maxHoa}`);
  if (q.petsAllowed) out.push("Pets OK");
  for (const f of q.features ?? []) out.push(AMENITIES[f as AmenityKey] ?? f);
  if (q.q) out.push(`“${q.q}”`);
  return out;
}
