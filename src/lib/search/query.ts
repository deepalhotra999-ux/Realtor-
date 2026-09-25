import { z } from "zod";
import { AMENITY_KEYS, LISTING_TYPES, PROPERTY_TYPES } from "@/lib/domain";

/**
 * The canonical search query. It is the contract between the URL, saved
 * searches, the AI natural-language parser and every SearchProvider.
 */

export const SORTS = [
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
  "sqft_desc",
  "ppsf_asc",
] as const;
export type SearchSort = (typeof SORTS)[number];

export const SORT_LABELS: Record<SearchSort, string> = {
  relevance: "Recommended",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  sqft_desc: "Largest",
  ppsf_asc: "Best value ($/sqft)",
};

const positiveInt = z.coerce.number().int().min(0);

export const bboxSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(([w, s, e, n]) => w < e && s < n && s >= -90 && n <= 90, "invalid bbox");
export type BBox = z.infer<typeof bboxSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  listingType: z.enum(LISTING_TYPES).default("sale"),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().length(2).toUpperCase().optional(),
  postalCode: z.string().trim().max(10).optional(),
  minPrice: positiveInt.optional(),
  maxPrice: positiveInt.optional(),
  minBeds: positiveInt.max(20).optional(),
  minBaths: z.coerce.number().min(0).max(20).optional(),
  minSqft: positiveInt.optional(),
  maxSqft: positiveInt.optional(),
  minYearBuilt: positiveInt.optional(),
  maxHoa: positiveInt.optional(),
  propertyTypes: z.array(z.enum(PROPERTY_TYPES)).default([]),
  features: z.array(z.enum(AMENITY_KEYS as [string, ...string[]])).default([]),
  petsAllowed: z.boolean().optional(),
  bbox: bboxSchema.optional(),
  near: z
    .object({ lat: z.number(), lng: z.number(), radiusKm: z.number().positive().max(500) })
    .optional(),
  sort: z.enum(SORTS).default("relevance"),
  page: positiveInt.min(1).default(1),
  pageSize: positiveInt.min(1).max(100).default(24),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchQueryInput = z.input<typeof searchQuerySchema>;

export const DEFAULT_QUERY: SearchQuery = searchQuerySchema.parse({});

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function getter(params: Params) {
  return (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
}

const list = (v?: string) =>
  v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
const num = (v?: string) =>
  v === undefined || v === "" || isNaN(Number(v)) ? undefined : Number(v);

/** Parse URL search params leniently — invalid values are dropped, never thrown. */
export function parseSearchParams(params: Params): SearchQuery {
  const get = getter(params);
  const bboxParts = list(get("bbox"))?.map(Number);
  const raw: Record<string, unknown> = {
    q: get("q") || undefined,
    listingType: get("type"),
    city: get("city"),
    state: get("state"),
    postalCode: get("zip"),
    minPrice: num(get("minPrice")),
    maxPrice: num(get("maxPrice")),
    minBeds: num(get("beds")),
    minBaths: num(get("baths")),
    minSqft: num(get("minSqft")),
    maxSqft: num(get("maxSqft")),
    minYearBuilt: num(get("minYear")),
    maxHoa: num(get("maxHoa")),
    propertyTypes: list(get("types")),
    features: list(get("features")),
    petsAllowed: get("pets") === "1" ? true : undefined,
    bbox: bboxParts?.length === 4 && bboxParts.every((n) => !isNaN(n)) ? bboxParts : undefined,
    sort: get("sort"),
    page: num(get("page")),
  };
  const lat = num(get("lat"));
  const lng = num(get("lng"));
  if (lat !== undefined && lng !== undefined)
    raw.near = { lat, lng, radiusKm: num(get("radius")) ?? 25 };

  // Validate field-by-field so one bad param does not discard the whole query.
  const shape = searchQuerySchema.shape;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    const field = shape[key as keyof typeof shape];
    if (Array.isArray(value) && key !== "bbox") {
      const inner = (field as z.ZodDefault<z.ZodArray<z.ZodType>>).unwrap().element;
      clean[key] = value.filter((v) => inner.safeParse(v).success);
      continue;
    }
    if (field.safeParse(value).success) clean[key] = value;
  }
  return searchQuerySchema.parse(clean);
}

/** Serialise a query to compact URL params (defaults omitted). */
export function toSearchParams(query: Partial<SearchQuery>): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    p.set(k, Array.isArray(v) ? v.join(",") : String(v));
  };
  set("q", query.q);
  if (query.listingType && query.listingType !== "sale") set("type", query.listingType);
  set("city", query.city);
  set("state", query.state);
  set("zip", query.postalCode);
  set("minPrice", query.minPrice);
  set("maxPrice", query.maxPrice);
  set("beds", query.minBeds);
  set("baths", query.minBaths);
  set("minSqft", query.minSqft);
  set("maxSqft", query.maxSqft);
  set("minYear", query.minYearBuilt);
  set("maxHoa", query.maxHoa);
  set("types", query.propertyTypes);
  set("features", query.features);
  if (query.petsAllowed) set("pets", "1");
  if (query.bbox)
    set(
      "bbox",
      query.bbox.map((n) => n.toFixed(5)),
    );
  if (query.near) {
    set("lat", query.near.lat);
    set("lng", query.near.lng);
    set("radius", query.near.radiusKm);
  }
  if (query.sort && query.sort !== "relevance") set("sort", query.sort);
  if (query.page && query.page > 1) set("page", query.page);
  return p;
}

/** Count of user-applied filters, for the "Filters (3)" badge. */
export function activeFilterCount(q: SearchQuery): number {
  let n = 0;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) n++;
  if (q.minBeds !== undefined) n++;
  if (q.minBaths !== undefined) n++;
  if (q.propertyTypes.length) n++;
  if (q.minSqft !== undefined || q.maxSqft !== undefined) n++;
  if (q.minYearBuilt !== undefined) n++;
  if (q.maxHoa !== undefined) n++;
  if (q.features.length) n += q.features.length;
  if (q.petsAllowed) n++;
  return n;
}
