import type { ListingStatus, ListingType, PropertyType } from "@/lib/domain";
import type { SearchQuery } from "@/lib/search/query";

/** Lightweight card-level listing projection returned by every search provider. */
export interface ListingSummary {
  id: string;
  slug: string;
  title: string;
  listingType: ListingType;
  status: ListingStatus;
  price: number;
  currency: string;
  isFeatured: boolean;
  listedAt: string | null;
  propertyType: PropertyType;
  street: string;
  unit: string | null;
  city: string;
  state: string;
  postalCode: string;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  hoaMonthly: number | null;
  features: string[];
  photoUrl: string | null;
  photoCount: number;
  agentName: string | null;
  brokerageName: string | null;
  nextOpenHouse: string | null;
  /** Reduction from the original list price, if any. */
  priceCut: number | null;
}

export interface MapPin {
  id: string;
  slug: string;
  lat: number;
  lng: number;
  price: number;
  listingType: ListingType;
  status: ListingStatus;
  beds: number | null;
  /** Living area in sqft; used for the $/sqft map coloring mode. */
  sqft: number | null;
  isFeatured: boolean;
}

export interface SearchStats {
  minPrice: number | null;
  maxPrice: number | null;
  medianPrice: number | null;
}

export interface SearchResults {
  items: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
  stats: SearchStats;
  tookMs: number;
}

export interface Suggestion {
  kind: "place" | "listing";
  label: string;
  sublabel?: string;
  href: string;
}

/**
 * Listing search. The default implementation uses PostgreSQL full-text search
 * plus PostGIS. Meilisearch, Typesense or OpenSearch adapters can implement
 * this interface and be selected via SEARCH_PROVIDER.
 */
export interface SearchProvider {
  readonly name: string;
  search(query: SearchQuery): Promise<SearchResults>;
  /** All matching pins (capped) for the map, ignoring pagination. */
  pins(query: SearchQuery, limit?: number): Promise<MapPin[]>;
  suggest(text: string, limit?: number): Promise<Suggestion[]>;
  /** Fetch summaries by id, preserving the given order. */
  byIds(ids: string[]): Promise<ListingSummary[]>;
}
