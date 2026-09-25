import type { ListingStatus, ListingType, PropertyType } from "@/lib/domain";

/**
 * Provider-neutral listing record. Every upstream source (seed data, RESO Web
 * API / MLS, IDX feeds, CSV imports) is normalised into this shape before the
 * import pipeline writes it to the database.
 */
export interface NormalizedListing {
  externalId: string;
  property: {
    propertyType: PropertyType;
    street: string;
    unit?: string | null;
    city: string;
    state: string;
    postalCode: string;
    neighborhood?: string | null;
    county?: string | null;
    latitude: number;
    longitude: number;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    lotSqft?: number | null;
    yearBuilt?: number | null;
    stories?: number | null;
    garageSpaces?: number | null;
    features: string[];
    hoaMonthly?: number | null;
    taxAnnual?: number | null;
    facts?: Record<string, unknown>;
  };
  listing: {
    listingType: ListingType;
    status: ListingStatus;
    price: number;
    title: string;
    description: string;
    listedAt: Date;
    closedAt?: Date | null;
    closePrice?: number | null;
    availableFrom?: string | null;
    leaseTermMonths?: number | null;
    deposit?: number | null;
    petsAllowed?: boolean | null;
    furnished?: boolean | null;
    openHouses?: { startsAt: string; endsAt: string }[];
    isFeatured?: boolean;
  };
  media: { url: string; alt: string; kind?: "photo" | "floorplan"; caption?: string }[];
  priceHistory: {
    event: "listed" | "price_change" | "pending" | "sold" | "rented" | "delisted" | "relisted";
    price: number;
    occurredAt: Date;
  }[];
  /** Upstream agent identifier, mapped to a local agent by the importer. */
  agentRef?: string;
}

export interface PropertyDataPage {
  records: NormalizedListing[];
  nextCursor?: string;
}

export interface PropertyDataProvider {
  readonly name: string;
  /** "seed" for demo data, "mls"/"import" for real feeds. */
  readonly source: "seed" | "mls" | "import";
  /** Human-readable disclosure shown in the UI for this data source. */
  readonly attribution: string;
  isConfigured(): boolean;
  fetchPage(cursor?: string, pageSize?: number): Promise<PropertyDataPage>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, missing: string[]) {
    super(`${provider} provider is not configured (missing: ${missing.join(", ")})`);
    this.name = "ProviderNotConfiguredError";
  }
}
