import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  agentProfiles,
  brokerages,
  events,
  leadActivities,
  leads,
  listings,
  properties,
  propertyMedia,
  tours,
  users,
} from "@/server/db/schema";
import type { SessionUser } from "@/server/auth/session";
import { LEAD_STAGES, type LeadStage } from "@/lib/crm";

/** Listings the user may manage: their own as agent/owner, or any for admins. */
function ownsListing(user: SessionUser): SQL | undefined {
  if (user.role === "admin") return undefined;
  return or(eq(listings.agentId, user.id), eq(listings.ownerId, user.id));
}

const OPEN_STAGES = LEAD_STAGES.filter((s) => s !== "closed_won" && s !== "closed_lost");

export async function getProOverview(userId: string) {
  const db = getDb();
  const mine = or(eq(listings.agentId, userId), eq(listings.ownerId, userId));
  const [[l], [ld], [v], followUps, upcoming, stageRows] = await Promise.all([
    db
      .select({
        active: sql<number>`count(*) filter (where ${listings.status} in ('active','coming_soon'))::int`,
        drafts: sql<number>`count(*) filter (where ${listings.status} = 'draft')::int`,
        pending: sql<number>`count(*) filter (where ${listings.status} = 'pending')::int`,
      })
      .from(listings)
      .where(mine),
    db
      .select({
        new30: sql<number>`count(*) filter (where ${leads.createdAt} > now() - interval '30 days')::int`,
        open: sql<number>`count(*) filter (where ${leads.stage} not in ('closed_won','closed_lost'))::int`,
        won: sql<number>`count(*) filter (where ${leads.stage} = 'closed_won')::int`,
      })
      .from(leads)
      .where(eq(leads.ownerId, userId)),
    db
      .select({ n: count() })
      .from(events)
      .innerJoin(listings, eq(listings.id, events.listingId))
      .where(
        and(
          mine,
          eq(events.type, "listing_view"),
          sql`${events.createdAt} > now() - interval '30 days'`,
        ),
      ),
    db
      .select({
        id: leads.id,
        name: leads.name,
        stage: leads.stage,
        nextFollowUpAt: leads.nextFollowUpAt,
        listing: listings.title,
      })
      .from(leads)
      .leftJoin(listings, eq(listings.id, leads.listingId))
      .where(
        and(
          eq(leads.ownerId, userId),
          inArray(leads.stage, OPEN_STAGES),
          lt(leads.nextFollowUpAt, sql`now() + interval '1 day'`),
        ),
      )
      .orderBy(asc(leads.nextFollowUpAt))
      .limit(6),
    db
      .select({
        id: tours.id,
        scheduledAt: tours.scheduledAt,
        status: tours.status,
        type: tours.type,
        contactName: tours.contactName,
        listing: listings.title,
        slug: listings.slug,
      })
      .from(tours)
      .innerJoin(listings, eq(listings.id, tours.listingId))
      .where(
        and(
          eq(tours.agentId, userId),
          inArray(tours.status, ["requested", "confirmed"]),
          gte(tours.scheduledAt, sql`now() - interval '2 hours'`),
        ),
      )
      .orderBy(asc(tours.scheduledAt))
      .limit(5),
    db
      .select({ stage: leads.stage, n: count() })
      .from(leads)
      .where(eq(leads.ownerId, userId))
      .groupBy(leads.stage),
  ]);
  return {
    listings: l,
    leads: ld,
    views30: v.n,
    followUps,
    upcoming,
    stages: Object.fromEntries(stageRows.map((s) => [s.stage, s.n])) as Record<string, number>,
  };
}

export async function listMyListings(user: SessionUser, status: string) {
  const conds = [ownsListing(user)];
  if (status !== "all") conds.push(sql`${listings.status} = ${status}`);
  const db = getDb();
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: listings.id,
        slug: listings.slug,
        title: listings.title,
        status: listings.status,
        listingType: listings.listingType,
        price: listings.price,
        isFeatured: listings.isFeatured,
        viewCount: listings.viewCount,
        saveCount: listings.saveCount,
        updatedAt: listings.updatedAt,
        street: properties.street,
        city: properties.city,
        state: properties.state,
        photo: sql<
          string | null
        >`(select url from property_media pm where pm.property_id = ${properties.id} order by pm.sort_order limit 1)`,
        leadCount: sql<number>`(select count(*)::int from leads x where x.listing_id = ${listings.id})`,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .where(and(...conds))
      .orderBy(desc(listings.updatedAt))
      .limit(200),
    db
      .select({ status: listings.status, n: count() })
      .from(listings)
      .where(ownsListing(user))
      .groupBy(listings.status),
  ]);
  return {
    rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>,
  };
}

export async function getMyListing(user: SessionUser, id: string) {
  const db = getDb();
  const [row] = await db
    .select({ l: listings, p: properties })
    .from(listings)
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .where(and(eq(listings.id, id), ownsListing(user)))
    .limit(1);
  if (!row) return null;
  const media = await db
    .select()
    .from(propertyMedia)
    .where(eq(propertyMedia.propertyId, row.p.id))
    .orderBy(asc(propertyMedia.sortOrder));
  return { ...row, media };
}

export async function listMyLeads(userId: string, opts: { q?: string; stage?: string }) {
  const conds: (SQL | undefined)[] = [eq(leads.ownerId, userId)];
  if (opts.q)
    conds.push(
      or(
        ilike(leads.name, `%${opts.q}%`),
        ilike(leads.email, `%${opts.q}%`),
        ilike(listings.title, `%${opts.q}%`),
      ),
    );
  if (opts.stage && opts.stage !== "all") conds.push(sql`${leads.stage} = ${opts.stage}`);
  return getDb()
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      stage: leads.stage,
      source: leads.source,
      score: leads.score,
      intent: leads.intent,
      createdAt: leads.createdAt,
      lastContactAt: leads.lastContactAt,
      nextFollowUpAt: leads.nextFollowUpAt,
      listing: listings.title,
      listingSlug: listings.slug,
    })
    .from(leads)
    .leftJoin(listings, eq(listings.id, leads.listingId))
    .where(and(...conds))
    .orderBy(desc(leads.score), desc(leads.createdAt))
    .limit(500);
}

export async function getLead(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select({
      lead: leads,
      listing: { id: listings.id, title: listings.title, slug: listings.slug },
    })
    .from(leads)
    .leftJoin(listings, eq(listings.id, leads.listingId))
    .where(and(eq(leads.id, id), eq(leads.ownerId, userId)))
    .limit(1);
  if (!row) return null;
  const [activities, leadTours] = await Promise.all([
    db
      .select({ a: leadActivities, actor: users.name })
      .from(leadActivities)
      .leftJoin(users, eq(users.id, leadActivities.actorId))
      .where(eq(leadActivities.leadId, id))
      .orderBy(desc(leadActivities.createdAt)),
    db.select().from(tours).where(eq(tours.leadId, id)).orderBy(desc(tours.scheduledAt)),
  ]);
  return { ...row, listing: row.listing?.id ? row.listing : null, activities, tours: leadTours };
}

export async function listMyTours(userId: string, scope: "upcoming" | "past") {
  const upcoming = scope === "upcoming";
  return getDb()
    .select({
      t: tours,
      listing: listings.title,
      slug: listings.slug,
      street: properties.street,
      city: properties.city,
    })
    .from(tours)
    .innerJoin(listings, eq(listings.id, tours.listingId))
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .where(
      and(
        eq(tours.agentId, userId),
        upcoming
          ? and(
              gte(tours.scheduledAt, sql`now() - interval '2 hours'`),
              inArray(tours.status, ["requested", "confirmed"]),
            )
          : or(
              lt(tours.scheduledAt, sql`now() - interval '2 hours'`),
              inArray(tours.status, ["completed", "cancelled", "no_show"]),
            ),
      ),
    )
    .orderBy(upcoming ? asc(tours.scheduledAt) : desc(tours.scheduledAt))
    .limit(200);
}

export async function getProAnalytics(userId: string, days: number) {
  const db = getDb();
  const since = sql`now() - make_interval(days => ${days})`;
  const mine = or(eq(listings.agentId, userId), eq(listings.ownerId, userId));
  const [perListing, daily, sources, [conv]] = await Promise.all([
    db
      .select({
        id: listings.id,
        slug: listings.slug,
        title: listings.title,
        status: listings.status,
        views: sql<number>`count(*) filter (where ${events.type} = 'listing_view')::int`,
        saves: sql<number>`count(*) filter (where ${events.type} = 'favorite')::int`,
        inquiries: sql<number>`count(*) filter (where ${events.type} in ('inquiry','tour_request'))::int`,
      })
      .from(listings)
      .leftJoin(events, and(eq(events.listingId, listings.id), gte(events.createdAt, since)))
      .where(mine)
      .groupBy(listings.id, listings.slug, listings.title, listings.status)
      .orderBy(desc(sql`count(*) filter (where ${events.type} = 'listing_view')`))
      .limit(50),
    db.execute<{ day: string; views: number; inquiries: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
        coalesce(sum(case when e.type = 'listing_view' then 1 end), 0)::int views,
        coalesce(sum(case when e.type in ('inquiry','tour_request') then 1 end), 0)::int inquiries
      from generate_series(current_date - (${days} - 1), current_date, interval '1 day') d
      left join (
        select ev.type, ev.created_at from events ev
        join listings li on li.id = ev.listing_id
        where (li.agent_id = ${userId} or li.owner_id = ${userId}) and ev.created_at > ${since}
      ) e on date_trunc('day', e.created_at) = d
      group by d order by d`),
    db
      .select({ source: leads.source, n: count() })
      .from(leads)
      .where(and(eq(leads.ownerId, userId), gte(leads.createdAt, since)))
      .groupBy(leads.source)
      .orderBy(desc(count())),
    db
      .select({
        total: count(),
        won: sql<number>`count(*) filter (where ${leads.stage} = 'closed_won')::int`,
        touring: sql<number>`count(*) filter (where ${leads.stage} in ('touring','offer','under_contract','closed_won'))::int`,
      })
      .from(leads)
      .where(and(eq(leads.ownerId, userId), gte(leads.createdAt, since))),
  ]);
  return { perListing, daily: [...daily], sources, conversion: conv };
}

export async function getMyAgentProfile(userId: string) {
  const [row] = await getDb()
    .select({ p: agentProfiles, brokerage: brokerages.name })
    .from(agentProfiles)
    .leftJoin(brokerages, eq(brokerages.id, agentProfiles.brokerageId))
    .where(eq(agentProfiles.userId, userId))
    .limit(1);
  return row ?? null;
}

export function isLeadStage(v: string): v is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(v);
}
