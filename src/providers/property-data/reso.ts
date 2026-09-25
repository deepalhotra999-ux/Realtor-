import type { ListingStatus, PropertyType } from "@/lib/domain";
import {
  ProviderNotConfiguredError,
  type NormalizedListing,
  type PropertyDataPage,
  type PropertyDataProvider,
} from "./types";

/**
 * RESO Web API adapter (OData, RESO Data Dictionary field names). This is the
 * integration point for MLS / IDX feeds you are licensed to use. It ships
 * disabled: set RESO_BASE_URL and RESO_ACCESS_TOKEN (and PROPERTY_DATA_PROVIDER=reso)
 * once you have your own feed credentials. Dwellwise does not include MLS data.
 */

/** Subset of the RESO Data Dictionary "Property" resource we map. */
export interface ResoProperty {
  ListingKey: string;
  StandardStatus?: string;
  ListPrice?: number;
  ClosePrice?: number;
  CloseDate?: string;
  ListingContractDate?: string;
  PropertyType?: string;
  PropertySubType?: string;
  UnparsedAddress?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetSuffix?: string;
  UnitNumber?: string;
  City?: string;
  StateOrProvince?: string;
  PostalCode?: string;
  CountyOrParish?: string;
  SubdivisionName?: string;
  Latitude?: number;
  Longitude?: number;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  BathroomsTotalDecimal?: number;
  LivingArea?: number;
  LotSizeSquareFeet?: number;
  YearBuilt?: number;
  StoriesTotal?: number;
  GarageSpaces?: number;
  AssociationFee?: number;
  TaxAnnualAmount?: number;
  PublicRemarks?: string;
  ListAgentKey?: string;
  PetsAllowed?: string[];
  Furnished?: string;
  Media?: { MediaURL?: string; ShortDescription?: string; Order?: number }[];
}

const STATUS_MAP: Record<string, ListingStatus> = {
  Active: "active",
  "Active Under Contract": "pending",
  "Coming Soon": "coming_soon",
  Pending: "pending",
  Closed: "sold",
  Withdrawn: "off_market",
  Expired: "off_market",
  Canceled: "off_market",
  Hold: "off_market",
};

function mapType(p: ResoProperty): { propertyType: PropertyType; listingType: "sale" | "rent" } {
  const lease = p.PropertyType?.toLowerCase().includes("lease") ?? false;
  const sub = (p.PropertySubType ?? "").toLowerCase();
  let propertyType: PropertyType = "single_family";
  if (sub.includes("condo")) propertyType = "condo";
  else if (sub.includes("town")) propertyType = "townhouse";
  else if (sub.includes("apartment")) propertyType = "apartment";
  else if (sub.includes("manufactured") || sub.includes("mobile")) propertyType = "manufactured";
  else if (p.PropertyType?.toLowerCase().includes("land")) propertyType = "land";
  else if (
    p.PropertyType?.toLowerCase().includes("income") ||
    sub.includes("duplex") ||
    sub.includes("plex")
  )
    propertyType = "multi_family";
  return { propertyType, listingType: lease ? "rent" : "sale" };
}

/** Pure mapping — returns null for records missing data we must not invent. */
export function mapResoProperty(p: ResoProperty): NormalizedListing | null {
  if (
    !p.ListingKey ||
    p.ListPrice == null ||
    p.Latitude == null ||
    p.Longitude == null ||
    !p.City ||
    !p.StateOrProvince
  ) {
    return null;
  }
  const { propertyType, listingType } = mapType(p);
  let status = STATUS_MAP[p.StandardStatus ?? ""] ?? "off_market";
  if (listingType === "rent" && status === "sold") status = "rented";
  const street =
    [p.StreetNumber, p.StreetName, p.StreetSuffix].filter(Boolean).join(" ") ||
    p.UnparsedAddress ||
    "Address withheld";
  const listedAt = p.ListingContractDate ? new Date(p.ListingContractDate) : new Date();

  return {
    externalId: p.ListingKey,
    property: {
      propertyType,
      street,
      unit: p.UnitNumber ?? null,
      city: p.City,
      state: p.StateOrProvince,
      postalCode: p.PostalCode ?? "",
      neighborhood: p.SubdivisionName ?? null,
      county: p.CountyOrParish ?? null,
      latitude: p.Latitude,
      longitude: p.Longitude,
      beds: p.BedroomsTotal ?? null,
      baths: p.BathroomsTotalDecimal ?? p.BathroomsTotalInteger ?? null,
      sqft: p.LivingArea ? Math.round(p.LivingArea) : null,
      lotSqft: p.LotSizeSquareFeet ? Math.round(p.LotSizeSquareFeet) : null,
      yearBuilt: p.YearBuilt ?? null,
      stories: p.StoriesTotal ?? null,
      garageSpaces: p.GarageSpaces ?? null,
      features: [],
      hoaMonthly: p.AssociationFee ?? null,
      taxAnnual: p.TaxAnnualAmount ?? null,
      facts: { resoPropertyType: p.PropertyType, resoPropertySubType: p.PropertySubType },
    },
    listing: {
      listingType,
      status,
      price: Math.round(p.ListPrice),
      title: `${street}, ${p.City}`,
      description: p.PublicRemarks ?? "",
      listedAt,
      closedAt: p.CloseDate ? new Date(p.CloseDate) : null,
      closePrice: p.ClosePrice ?? null,
      petsAllowed: p.PetsAllowed ? !p.PetsAllowed.includes("No") : null,
      furnished: p.Furnished ? p.Furnished.toLowerCase() === "furnished" : null,
    },
    media: (p.Media ?? [])
      .filter((m) => m.MediaURL)
      .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
      .map((m) => ({ url: m.MediaURL!, alt: m.ShortDescription ?? "Listing photo" })),
    priceHistory: [{ event: "listed", price: Math.round(p.ListPrice), occurredAt: listedAt }],
    agentRef: p.ListAgentKey,
  };
}

export class ResoWebApiProvider implements PropertyDataProvider {
  readonly name = "reso";
  readonly source = "mls" as const;
  readonly attribution = "Listing data provided by your licensed MLS via the RESO Web API.";

  constructor(
    private readonly baseUrl?: string,
    private readonly token?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured() {
    return Boolean(this.baseUrl && this.token);
  }

  async fetchPage(cursor?: string, pageSize = 200): Promise<PropertyDataPage> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(
        "RESO",
        ["RESO_BASE_URL", "RESO_ACCESS_TOKEN"].filter((k) =>
          k === "RESO_BASE_URL" ? !this.baseUrl : !this.token,
        ),
      );
    }
    const url =
      cursor ?? `${this.baseUrl!.replace(/\/$/, "")}/Property?$top=${pageSize}&$expand=Media`;
    const res = await this.fetchImpl(url, {
      headers: { authorization: `Bearer ${this.token}`, accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`RESO Web API returned ${res.status}`);
    const body = (await res.json()) as { value: ResoProperty[]; "@odata.nextLink"?: string };
    return {
      records: body.value.map(mapResoProperty).filter((r): r is NormalizedListing => r !== null),
      nextCursor: body["@odata.nextLink"],
    };
  }
}
