import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { agentProfiles, brokerages, listings, reviews, users } from "@/server/db/schema";
import { getSearch } from "@/providers";

export interface AgentFilters {
  q?: string;
  city?: string;
  specialty?: string;
  language?: string;
  sort?: "rating" | "reviews" | "deals" | "experience";
}

const agentColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  slug: agentProfiles.slug,
  headline: agentProfiles.headline,
  photoUrl: agentProfiles.photoUrl,
  ratingAvg: agentProfiles.ratingAvg,
  reviewCount: agentProfiles.reviewCount,
  verified: agentProfiles.verified,
  yearsExperience: agentProfiles.yearsExperience,
  specialties: agentProfiles.specialties,
  languages: agentProfiles.languages,
  serviceAreas: agentProfiles.serviceAreas,
  closedDeals12mo: agentProfiles.closedDeals12mo,
  brokerageName: brokerages.name,
  brokerageCity: brokerages.city,
  brokerageState: brokerages.state,
  activeListings: sql<number>`(select count(*)::int from listings l where l.agent_id = ${users.id} and l.status in ('active','coming_soon'))`,
};

/**
 * Recompute an agent's rating from published reviews. Lives here (server-only)
 * rather than in a "use server" file so browsers can't invoke it directly.
 */
export async function refreshAgentRating(agentId: string) {
  const db = getDb();
  const [agg] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::real`,
      n: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.agentId, agentId), eq(reviews.status, "published")));
  await db
    .update(agentProfiles)
    .set({ ratingAvg: agg?.avg ?? 0, reviewCount: agg?.n ?? 0 })
    .where(eq(agentProfiles.userId, agentId));
}

export async function listAgents(f: AgentFilters, limit = 60) {
  const conds = [eq(users.status, "active")];
  if (f.q) conds.push(or(ilike(users.name, `%${f.q}%`), ilike(brokerages.name, `%${f.q}%`))!);
  if (f.city)
    conds.push(
      sql`(${brokerages.city} ilike ${f.city} or exists (select 1 from listings l join properties p on p.id = l.property_id where l.agent_id = ${users.id} and p.city ilike ${f.city}))`,
    );
  if (f.specialty) conds.push(sql`${f.specialty} = any(${agentProfiles.specialties})`);
  if (f.language) conds.push(sql`${f.language} = any(${agentProfiles.languages})`);
  const order =
    f.sort === "reviews"
      ? desc(agentProfiles.reviewCount)
      : f.sort === "deals"
        ? desc(agentProfiles.closedDeals12mo)
        : f.sort === "experience"
          ? desc(agentProfiles.yearsExperience)
          : sql`${agentProfiles.ratingAvg} * least(${agentProfiles.reviewCount}, 5) desc`;
  return getDb()
    .select(agentColumns)
    .from(agentProfiles)
    .innerJoin(users, eq(agentProfiles.userId, users.id))
    .leftJoin(brokerages, eq(agentProfiles.brokerageId, brokerages.id))
    .where(and(...conds))
    .orderBy(order)
    .limit(limit);
}

export async function getAgentFacets() {
  const db = getDb();
  const [spec, lang, cities] = await Promise.all([
    db.execute<{ v: string }>(
      sql`select distinct unnest(specialties) v from agent_profiles order by 1`,
    ),
    db.execute<{ v: string }>(
      sql`select distinct unnest(languages) v from agent_profiles order by 1`,
    ),
    db.execute<{ v: string }>(
      sql`select distinct city v from brokerages where city is not null order by 1`,
    ),
  ]);
  return {
    specialties: spec.map((r) => r.v),
    languages: lang.map((r) => r.v),
    cities: cities.map((r) => r.v),
  };
}

export async function getAgentBySlug(slug: string) {
  const db = getDb();
  const [agent] = await db
    .select({
      ...agentColumns,
      bio: agentProfiles.bio,
      licenseNumber: agentProfiles.licenseNumber,
      licenseState: agentProfiles.licenseState,
      phone: agentProfiles.phone,
      email: users.email,
      acceptingClients: agentProfiles.acceptingClients,
      brokerageSlug: brokerages.slug,
    })
    .from(agentProfiles)
    .innerJoin(users, eq(agentProfiles.userId, users.id))
    .leftJoin(brokerages, eq(agentProfiles.brokerageId, brokerages.id))
    .where(eq(agentProfiles.slug, slug))
    .limit(1);
  if (!agent) return null;
  const [listingIds, agentReviews, sold] = await Promise.all([
    db
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          eq(listings.agentId, agent.id),
          inArray(listings.status, ["active", "coming_soon", "pending"]),
        ),
      )
      .orderBy(desc(listings.listedAt))
      .limit(12),
    db
      .select()
      .from(reviews)
      .where(and(eq(reviews.agentId, agent.id), eq(reviews.status, "published")))
      .orderBy(desc(reviews.createdAt))
      .limit(30),
    db
      .select({
        n: sql<number>`count(*)::int`,
        median: sql<
          number | null
        >`percentile_cont(0.5) within group (order by coalesce(${listings.closePrice}, ${listings.price}))::int`,
      })
      .from(listings)
      .where(and(eq(listings.agentId, agent.id), inArray(listings.status, ["sold", "rented"]))),
  ]);
  const agentListings = await getSearch().byIds(listingIds.map((r) => r.id));
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: agentReviews.filter((r) => r.rating === stars).length,
  }));
  return {
    agent,
    listings: agentListings,
    reviews: agentReviews,
    distribution,
    closed: sold[0] ?? { n: 0, median: null },
  };
}
