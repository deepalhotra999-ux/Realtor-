import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  agentProfiles,
  brokerages,
  events,
  favorites,
  listings,
  priceHistory,
  properties,
  propertyMedia,
  users,
} from "@/server/db/schema";
import { getSearch } from "@/providers";
import { ownerInGoodStanding } from "@/server/search/postgres";
import { DEFAULT_QUERY, type SearchQuery } from "@/lib/search/query";
import type { ListingDetail, ListingSummary } from "@/lib/listing-types";

const HIDDEN_STATUSES: string[] = ["draft", "pending_review", "suspended", "removed"];

export const getListingDetail = cache(async (slug: string): Promise<ListingDetail | null> => {
  const db = getDb();
  const [row] = await db
    .select({
      l: listings,
      p: properties,
      agent: {
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
      },
      profile: {
        slug: agentProfiles.slug,
        headline: agentProfiles.headline,
        photoUrl: agentProfiles.photoUrl,
        phone: agentProfiles.phone,
        ratingAvg: agentProfiles.ratingAvg,
        reviewCount: agentProfiles.reviewCount,
        verified: agentProfiles.verified,
      },
      brokerageName: brokerages.name,
    })
    .from(listings)
    .innerJoin(properties, eq(listings.propertyId, properties.id))
    .leftJoin(users, eq(listings.agentId, users.id))
    .leftJoin(agentProfiles, eq(agentProfiles.userId, users.id))
    .leftJoin(brokerages, eq(listings.brokerageId, brokerages.id))
    .where(eq(listings.slug, slug))
    .limit(1);
  // Drafts, listings under review and moderated listings are never public.
  if (!row || HIDDEN_STATUSES.includes(row.l.status)) return null;
  const [owner] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.id, row.l.id), sql`not (${ownerInGoodStanding})`));
  if (owner.n > 0) return null;

  const [media, history, summary] = await Promise.all([
    db
      .select()
      .from(propertyMedia)
      .where(eq(propertyMedia.propertyId, row.p.id))
      .orderBy(asc(propertyMedia.sortOrder)),
    db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.listingId, row.l.id))
      .orderBy(asc(priceHistory.occurredAt)),
    getSearch().byIds([row.l.id]),
  ]);
  const base = summary[0];
  if (!base) return null;

  return {
    ...base,
    propertyId: row.p.id,
    description: row.l.description,
    county: row.p.county,
    stories: row.p.stories,
    garageSpaces: row.p.garageSpaces,
    taxAnnual: row.p.taxAnnual,
    facts: row.p.facts,
    closedAt: row.l.closedAt?.toISOString() ?? null,
    closePrice: row.l.closePrice,
    availableFrom: row.l.availableFrom,
    leaseTermMonths: row.l.leaseTermMonths,
    deposit: row.l.deposit,
    petsAllowed: row.l.petsAllowed,
    furnished: row.l.furnished,
    openHouses: row.l.openHouses,
    viewCount: row.l.viewCount,
    saveCount: row.l.saveCount,
    source: row.p.source,
    media: media.map((m) => ({
      id: m.id,
      url: m.url,
      alt: m.alt,
      kind: m.kind,
      caption: m.caption,
    })),
    priceHistory: history.map((h) => ({
      event: h.event,
      price: h.price,
      occurredAt: h.occurredAt.toISOString(),
    })),
    agent: row.agent?.id
      ? {
          id: row.agent.id,
          name: row.agent.name,
          email: row.agent.email,
          phone: row.profile?.phone ?? row.agent.phone,
          slug: row.profile?.slug ?? null,
          photoUrl: row.profile?.photoUrl ?? row.agent.avatarUrl,
          headline: row.profile?.headline ?? null,
          ratingAvg: row.profile?.ratingAvg ?? 0,
          reviewCount: row.profile?.reviewCount ?? 0,
          verified: row.profile?.verified ?? false,
          brokerageName: row.brokerageName,
        }
      : null,
  };
});

/** Similar homes: same type of listing, nearby, similar price. */
export async function getSimilarListings(l: ListingDetail, limit = 8): Promise<ListingSummary[]> {
  const db = getDb();
  const ids = await db
    .select({ id: listings.id })
    .from(listings)
    .innerJoin(properties, eq(listings.propertyId, properties.id))
    .where(
      and(
        ne(listings.id, l.id),
        eq(listings.listingType, l.listingType),
        inArray(listings.status, ["active", "coming_soon"]),
        ownerInGoodStanding,
        sql`${listings.price} between ${Math.round(l.price * 0.7)} and ${Math.round(l.price * 1.35)}`,
        sql`ST_DWithin(${properties.location}::geography, ST_SetSRID(ST_MakePoint(${l.longitude}, ${l.latitude}), 4326)::geography, 12000)`,
      ),
    )
    .orderBy(
      sql`${properties.location} <-> ST_SetSRID(ST_MakePoint(${l.longitude}, ${l.latitude}), 4326)`,
    )
    .limit(limit);
  return getSearch().byIds(ids.map((r) => r.id));
}

export async function getFeaturedListings(
  limit = 8,
  sort: SearchQuery["sort"] = "relevance",
): Promise<ListingSummary[]> {
  const res = await getSearch().search({ ...DEFAULT_QUERY, pageSize: limit, sort });
  return res.items;
}

export async function searchListings(query: Partial<SearchQuery>) {
  return getSearch().search({ ...DEFAULT_QUERY, ...query });
}

export interface CityStat {
  city: string;
  state: string;
  forSale: number;
  forRent: number;
  medianSale: number | null;
  medianRent: number | null;
}

export async function getCityStats(): Promise<CityStat[]> {
  const rows = await getDb()
    .select({
      city: properties.city,
      state: properties.state,
      forSale: sql<number>`count(*) filter (where ${listings.listingType} = 'sale')::int`,
      forRent: sql<number>`count(*) filter (where ${listings.listingType} = 'rent')::int`,
      medianSale: sql<
        number | null
      >`(percentile_cont(0.5) within group (order by ${listings.price}) filter (where ${listings.listingType} = 'sale'))::int`,
      medianRent: sql<
        number | null
      >`(percentile_cont(0.5) within group (order by ${listings.price}) filter (where ${listings.listingType} = 'rent'))::int`,
    })
    .from(listings)
    .innerJoin(properties, eq(listings.propertyId, properties.id))
    .where(inArray(listings.status, ["active", "coming_soon"]))
    .groupBy(properties.city, properties.state)
    .orderBy(desc(sql`count(*)`));
  return rows;
}

export async function getFavoriteIds(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await getDb()
    .select({ id: favorites.listingId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  return new Set(rows.map((r) => r.id));
}

export async function getFavoriteListings(userId: string): Promise<ListingSummary[]> {
  const rows = await getDb()
    .select({ id: favorites.listingId })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  return getSearch().byIds(rows.map((r) => r.id));
}

/** Fire-and-forget analytics event. Never throws. */
export function trackEvent(e: {
  type: string;
  userId?: string | null;
  listingId?: string | null;
  anonymousId?: string | null;
  meta?: Record<string, unknown>;
}) {
  const db = getDb();
  void db
    .insert(events)
    .values({
      type: e.type,
      userId: e.userId ?? null,
      listingId: e.listingId ?? null,
      anonymousId: e.anonymousId ?? null,
      meta: e.meta ?? {},
    })
    .then(() =>
      e.type === "listing_view" && e.listingId
        ? db
            .update(listings)
            .set({ viewCount: sql`${listings.viewCount} + 1` })
            .where(eq(listings.id, e.listingId))
        : undefined,
    )
    .catch(() => {});
}
