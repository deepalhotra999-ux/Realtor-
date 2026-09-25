import type { ListingSummary } from "@/providers/search/types";

export type { ListingSummary };

export interface PriceHistoryEntry {
  event: "listed" | "price_change" | "pending" | "sold" | "rented" | "delisted" | "relisted";
  price: number;
  occurredAt: string;
}

export interface MediaItem {
  id: string;
  url: string;
  alt: string;
  kind: "photo" | "floorplan" | "video" | "virtual_tour";
  caption: string | null;
}

export interface AgentCard {
  id: string;
  name: string;
  slug: string | null;
  phone: string | null;
  email: string;
  photoUrl: string | null;
  headline: string | null;
  ratingAvg: number;
  reviewCount: number;
  verified: boolean;
  brokerageName: string | null;
}

/** Everything the property detail page and the AI Q&A are allowed to know. */
export interface ListingDetail extends ListingSummary {
  propertyId: string;
  description: string;
  county: string | null;
  stories: number | null;
  garageSpaces: number | null;
  taxAnnual: number | null;
  facts: Record<string, unknown>;
  closedAt: string | null;
  closePrice: number | null;
  availableFrom: string | null;
  leaseTermMonths: number | null;
  deposit: number | null;
  petsAllowed: boolean | null;
  furnished: boolean | null;
  openHouses: { startsAt: string; endsAt: string }[];
  viewCount: number;
  saveCount: number;
  media: MediaItem[];
  priceHistory: PriceHistoryEntry[];
  agent: AgentCard | null;
  source: "seed" | "manual" | "mls" | "import";
}
