import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db";
import { agentProfiles, brokerages, listings, properties, users } from "@/server/db/schema";
import type { SearchQuery } from "@/lib/search/query";
import type {
  ListingSummary,
  MapPin,
  SearchProvider,
  SearchResults,
  Suggestion,
} from "@/providers/search/types";
import { getGeocoding } from "@/providers";

const VISIBLE_STATUSES = ["active", "coming_soon"] as const;

/**
 * Hide listings whose agent/owner is suspended, banned or deleted. Evaluated
 * at query time, so reinstating the account restores them automatically.
 */
export const ownerInGoodStanding = sql`not exists (
  select 1 from users acct
  where acct.id in (${listings.agentId}, ${listings.ownerId})
    and acct.status in ('suspended', 'banned', 'deleted'))`;

/** PostgreSQL full-text + PostGIS search. Zero external services. */
export class PostgresSearchProvider implements SearchProvider {
  readonly name = "postgres";

  constructor(private readonly db: () => Database) {}

  private conditions(q: SearchQuery): SQL[] {
    const c: SQL[] = [
      eq(listings.listingType, q.listingType),
      inArray(listings.status, [...VISIBLE_STATUSES]),
      ownerInGoodStanding,
    ];
    if (q.city) c.push(sql`lower(${properties.city}) = lower(${q.city})`);
    if (q.state) c.push(eq(properties.state, q.state));
    if (q.postalCode) c.push(sql`${properties.postalCode} like ${q.postalCode + "%"}`);
    if (q.minPrice !== undefined) c.push(gte(listings.price, q.minPrice));
    if (q.maxPrice !== undefined) c.push(lte(listings.price, q.maxPrice));
    if (q.minBeds !== undefined) c.push(gte(properties.beds, q.minBeds));
    if (q.minBaths !== undefined) c.push(gte(properties.baths, q.minBaths));
    if (q.minSqft !== undefined) c.push(gte(properties.sqft, q.minSqft));
    if (q.maxSqft !== undefined) c.push(lte(properties.sqft, q.maxSqft));
    if (q.minYearBuilt !== undefined) c.push(gte(properties.yearBuilt, q.minYearBuilt));
    if (q.maxHoa !== undefined) c.push(sql`coalesce(${properties.hoaMonthly}, 0) <= ${q.maxHoa}`);
    if (q.propertyTypes.length) c.push(inArray(properties.propertyType, q.propertyTypes));
    if (q.features.length) {
      c.push(
        sql`${properties.features} @> ARRAY[${sql.join(
          q.features.map((f) => sql`${f}`),
          sql`, `,
        )}]::text[]`,
      );
    }
    if (q.petsAllowed) c.push(eq(listings.petsAllowed, true));
    if (q.bbox) {
      const [w, s, e, n] = q.bbox;
      c.push(sql`${properties.location} && ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326)`);
    }
    if (q.near) {
      c.push(
        sql`ST_DWithin(${properties.location}::geography, ST_SetSRID(ST_MakePoint(${q.near.lng}, ${q.near.lat}), 4326)::geography, ${q.near.radiusKm * 1000})`,
      );
    }
    if (q.q) {
      const like = `%${q.q.replace(/[%_]/g, "")}%`;
      c.push(sql`(
        ${listings.searchVector} @@ websearch_to_tsquery('english', ${q.q})
        OR ${properties.city} ILIKE ${like}
        OR ${properties.neighborhood} ILIKE ${like}
        OR ${properties.street} ILIKE ${like}
        OR ${properties.postalCode} LIKE ${q.q.trim() + "%"}
      )`);
    }
    return c;
  }

  private orderBy(q: SearchQuery): SQL[] {
    switch (q.sort) {
      case "newest":
        return [sql`${listings.listedAt} desc nulls last`];
      case "price_asc":
        return [asc(listings.price)];
      case "price_desc":
        return [desc(listings.price)];
      case "sqft_desc":
        return [sql`${properties.sqft} desc nulls last`];
      case "ppsf_asc":
        return [sql`(${listings.price}::float / nullif(${properties.sqft}, 0)) asc nulls last`];
      case "relevance":
      default: {
        const featured = sql`(${listings.isFeatured} and coalesce(${listings.featuredUntil}, 'infinity') > now()) desc`;
        const rank = q.q
          ? sql`ts_rank(${listings.searchVector}, websearch_to_tsquery('english', ${q.q})) desc`
          : sql`${listings.saveCount} + ${listings.viewCount} / 20 desc`;
        return [featured, rank, sql`${listings.listedAt} desc nulls last`];
      }
    }
  }

  private summaryColumns() {
    return {
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      listingType: listings.listingType,
      status: listings.status,
      price: listings.price,
      currency: listings.currency,
      isFeatured: listings.isFeatured,
      listedAt: listings.listedAt,
      propertyType: properties.propertyType,
      street: properties.street,
      unit: properties.unit,
      city: properties.city,
      state: properties.state,
      postalCode: properties.postalCode,
      neighborhood: properties.neighborhood,
      latitude: properties.latitude,
      longitude: properties.longitude,
      beds: properties.beds,
      baths: properties.baths,
      sqft: properties.sqft,
      lotSqft: properties.lotSqft,
      yearBuilt: properties.yearBuilt,
      hoaMonthly: properties.hoaMonthly,
      features: properties.features,
      photoUrl: sql<
        string | null
      >`(select url from property_media pm where pm.property_id = ${properties.id} order by pm.sort_order limit 1)`,
      photoCount: sql<number>`(select count(*)::int from property_media pm where pm.property_id = ${properties.id})`,
      agentName: users.name,
      brokerageName: brokerages.name,
      nextOpenHouse: sql<
        string | null
      >`(select min(oh->>'startsAt') from jsonb_array_elements(${listings.openHouses}) oh where (oh->>'startsAt')::timestamptz > now())`,
      priceCut: sql<
        number | null
      >`(select nullif(max(ph.price) - ${listings.price}, 0) from price_history ph where ph.listing_id = ${listings.id} and ph.event in ('listed','price_change') and ph.price > ${listings.price})`,
    };
  }

  private baseQuery() {
    return this.db()
      .select(this.summaryColumns())
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .leftJoin(users, eq(listings.agentId, users.id))
      .leftJoin(agentProfiles, eq(agentProfiles.userId, users.id))
      .leftJoin(brokerages, eq(listings.brokerageId, brokerages.id));
  }

  private toSummary(
    row: Awaited<ReturnType<ReturnType<PostgresSearchProvider["baseQuery"]>["execute"]>>[number],
  ): ListingSummary {
    return { ...row, listedAt: row.listedAt ? row.listedAt.toISOString() : null };
  }

  async search(q: SearchQuery): Promise<SearchResults> {
    const started = performance.now();
    const where = and(...this.conditions(q));
    const offset = (q.page - 1) * q.pageSize;

    const [rows, [agg]] = await Promise.all([
      this.baseQuery()
        .where(where)
        .orderBy(...this.orderBy(q))
        .limit(q.pageSize)
        .offset(offset),
      this.db()
        .select({
          total: sql<number>`count(*)::int`,
          minPrice: sql<number | null>`min(${listings.price})`,
          maxPrice: sql<number | null>`max(${listings.price})`,
          medianPrice: sql<
            number | null
          >`percentile_cont(0.5) within group (order by ${listings.price})::int`,
        })
        .from(listings)
        .innerJoin(properties, eq(listings.propertyId, properties.id))
        .where(where),
    ]);

    return {
      items: rows.map((r) => this.toSummary(r)),
      total: agg?.total ?? 0,
      page: q.page,
      pageSize: q.pageSize,
      stats: {
        minPrice: agg?.minPrice ?? null,
        maxPrice: agg?.maxPrice ?? null,
        medianPrice: agg?.medianPrice ?? null,
      },
      tookMs: Math.round(performance.now() - started),
    };
  }

  async pins(q: SearchQuery, limit = 1500): Promise<MapPin[]> {
    return this.db()
      .select({
        id: listings.id,
        slug: listings.slug,
        lat: properties.latitude,
        lng: properties.longitude,
        price: listings.price,
        listingType: listings.listingType,
        status: listings.status,
        beds: properties.beds,
        isFeatured: listings.isFeatured,
      })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(and(...this.conditions(q)))
      .orderBy(...this.orderBy(q))
      .limit(limit);
  }

  async suggest(text: string, limit = 8): Promise<Suggestion[]> {
    const t = text.trim();
    if (t.length < 2) return [];
    const places = await getGeocoding().geocode(t, { limit: 5 });
    const placeSuggestions: Suggestion[] = places.map((p) => {
      // `place` is a display label; the bbox does the actual filtering.
      const params = new URLSearchParams({ place: p.label });
      if (p.bbox) params.set("bbox", p.bbox.map((n) => n.toFixed(5)).join(","));
      return {
        kind: "place",
        label: p.label,
        sublabel:
          p.kind === "neighborhood"
            ? "Neighborhood"
            : p.kind === "city"
              ? "City"
              : p.kind === "state"
                ? "State"
                : "ZIP code",
        href: `/search?${params}`,
      };
    });
    const like = `%${t.replace(/[%_]/g, "")}%`;
    const addr = await this.db()
      .select({
        slug: listings.slug,
        street: properties.street,
        city: properties.city,
        state: properties.state,
      })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(
        and(
          inArray(listings.status, [...VISIBLE_STATUSES]),
          ownerInGoodStanding,
          sql`${properties.street} ILIKE ${like}`,
        ),
      )
      .limit(Math.max(0, limit - placeSuggestions.length));
    return [
      ...placeSuggestions,
      ...addr.map((a) => ({
        kind: "listing" as const,
        label: a.street,
        sublabel: `${a.city}, ${a.state}`,
        href: `/homes/${a.slug}`,
      })),
    ].slice(0, limit);
  }

  async byIds(ids: string[]): Promise<ListingSummary[]> {
    if (!ids.length) return [];
    const rows = await this.baseQuery().where(inArray(listings.id, ids));
    const map = new Map(rows.map((r) => [r.id, this.toSummary(r)]));
    return ids.map((id) => map.get(id)).filter((x): x is ListingSummary => Boolean(x));
  }
}
