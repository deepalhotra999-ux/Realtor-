import "server-only";
import { and, count, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  agentProfiles,
  aiRequests,
  auditLogs,
  brokerages,
  events,
  featureFlags,
  features,
  leads,
  listings,
  outboundMessages,
  payments,
  planEntitlements,
  plans,
  properties,
  reports,
  reviews,
  subscriptions,
  tours,
  users,
} from "@/server/db/schema";

export const PAGE_SIZE = 25;

function pct(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

/** Count rows created in the last 30 days vs the 30 before. */
async function windowed(
  table: typeof users | typeof listings | typeof leads | typeof tours | typeof aiRequests,
  col: SQL | ReturnType<typeof sql>,
) {
  const [r] = await getDb()
    .select({
      cur: sql<number>`count(*) filter (where ${col} > now() - interval '30 days')::int`,
      prev: sql<number>`count(*) filter (where ${col} <= now() - interval '30 days' and ${col} > now() - interval '60 days')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(table);
  return { ...r, delta: pct(r.cur, r.prev) };
}

export async function getOverview() {
  const db = getDb();
  const [
    u,
    l,
    ld,
    t,
    ai,
    activeListings,
    pendingReviews,
    openReports,
    revenue,
    views,
    recentAudit,
    subsByStatus,
  ] = await Promise.all([
    windowed(users, sql`${users.createdAt}`),
    windowed(listings, sql`${listings.createdAt}`),
    windowed(leads, sql`${leads.createdAt}`),
    windowed(tours, sql`${tours.createdAt}`),
    windowed(aiRequests, sql`${aiRequests.createdAt}`),
    db
      .select({ n: count() })
      .from(listings)
      .where(sql`${listings.status} in ('active','coming_soon')`),
    db.select({ n: count() }).from(reviews).where(eq(reviews.status, "pending")),
    db
      .select({ n: count() })
      .from(reports)
      .where(sql`${reports.status} in ('open','reviewing')`),
    db
      .select({
        cents: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'succeeded' and ${payments.createdAt} > now() - interval '30 days'), 0)::int`,
      })
      .from(payments),
    db.execute<{ day: string; n: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day, coalesce(e.n, 0)::int as n
      from generate_series(current_date - 29, current_date, interval '1 day') d
      left join (select date_trunc('day', created_at) as day, count(*) n from events where type = 'listing_view' and created_at > current_date - 30 group by 1) e on e.day = d
      order by d`),
    db
      .select({ a: auditLogs, actor: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
    db
      .select({ status: subscriptions.status, n: count() })
      .from(subscriptions)
      .groupBy(subscriptions.status),
  ]);
  return {
    users: u,
    listings: l,
    leads: ld,
    tours: t,
    ai,
    activeListings: activeListings[0].n,
    pendingReviews: pendingReviews[0].n,
    openReports: openReports[0].n,
    revenue30dCents: revenue[0].cents,
    views: [...views],
    recentAudit,
    subsByStatus: Object.fromEntries(subsByStatus.map((s) => [s.status, s.n])) as Record<
      string,
      number
    >,
  };
}

export async function getModerationCounts() {
  const db = getDb();
  try {
    const [[r], [p]] = await Promise.all([
      db.select({ n: count() }).from(reviews).where(eq(reviews.status, "pending")),
      db
        .select({ n: count() })
        .from(reports)
        .where(sql`${reports.status} in ('open','reviewing')`),
    ]);
    return { reviews: r.n, reports: p.n };
  } catch {
    return { reviews: 0, reports: 0 };
  }
}

export async function listUsers(opts: { q?: string; role?: string; page: number }) {
  const conds: SQL[] = [];
  if (opts.q) conds.push(or(ilike(users.name, `%${opts.q}%`), ilike(users.email, `%${opts.q}%`))!);
  if (opts.role && opts.role !== "all") conds.push(sql`${users.role} = ${opts.role}`);
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const [rows, [{ n }], roleCounts] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        listings: sql<number>`(select count(*)::int from listings l where l.agent_id = users.id or l.owner_id = users.id)`,
        plan: sql<
          string | null
        >`(select p.name from subscriptions s join plans p on p.id = s.plan_id where s.user_id = users.id and s.status in ('trialing','active','past_due') order by s.created_at desc limit 1)`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(users).where(where),
    db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
  ]);
  return {
    rows,
    total: n,
    roleCounts: Object.fromEntries(roleCounts.map((r) => [r.role, r.n])) as Record<string, number>,
  };
}

export async function listAgentsAdmin(opts: { q?: string; verified?: string; page: number }) {
  const conds: SQL[] = [];
  if (opts.q)
    conds.push(or(ilike(users.name, `%${opts.q}%`), ilike(brokerages.name, `%${opts.q}%`))!);
  if (opts.verified === "yes") conds.push(eq(agentProfiles.verified, true));
  if (opts.verified === "no") conds.push(eq(agentProfiles.verified, false));
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const base = db
    .select({ n: count() })
    .from(agentProfiles)
    .innerJoin(users, eq(users.id, agentProfiles.userId))
    .leftJoin(brokerages, eq(brokerages.id, agentProfiles.brokerageId))
    .where(where);
  const [rows, [{ n }], brokerageRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        slug: agentProfiles.slug,
        verified: agentProfiles.verified,
        licenseNumber: agentProfiles.licenseNumber,
        licenseState: agentProfiles.licenseState,
        ratingAvg: agentProfiles.ratingAvg,
        reviewCount: agentProfiles.reviewCount,
        brokerage: brokerages.name,
        activeListings: sql<number>`(select count(*)::int from listings l where l.agent_id = ${users.id} and l.status in ('active','coming_soon'))`,
        leads30: sql<number>`(select count(*)::int from leads x where x.owner_id = ${users.id} and x.created_at > now() - interval '30 days')`,
      })
      .from(agentProfiles)
      .innerJoin(users, eq(users.id, agentProfiles.userId))
      .leftJoin(brokerages, eq(brokerages.id, agentProfiles.brokerageId))
      .where(where)
      .orderBy(agentProfiles.verified, desc(agentProfiles.reviewCount))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    base,
    db
      .select({
        id: brokerages.id,
        name: brokerages.name,
        city: brokerages.city,
        state: brokerages.state,
        // Single-table select: Drizzle renders ${brokerages.id} as bare "id" here, which the
        // subquery would resolve to its own id column. Qualify with the outer table name instead.
        agents: sql<number>`(select count(*)::int from agent_profiles a where a.brokerage_id = brokerages.id)`,
        listings: sql<number>`(select count(*)::int from listings l where l.brokerage_id = brokerages.id and l.status in ('active','coming_soon'))`,
      })
      .from(brokerages)
      .orderBy(brokerages.name),
  ]);
  return { rows, total: n, brokerages: brokerageRows };
}

export async function listListingsAdmin(opts: {
  q?: string;
  status?: string;
  type?: string;
  page: number;
}) {
  const conds: SQL[] = [];
  if (opts.q)
    conds.push(
      or(
        ilike(listings.title, `%${opts.q}%`),
        ilike(properties.street, `%${opts.q}%`),
        ilike(properties.city, `%${opts.q}%`),
      )!,
    );
  if (opts.status && opts.status !== "all") conds.push(sql`${listings.status} = ${opts.status}`);
  if (opts.type && opts.type !== "all") conds.push(sql`${listings.listingType} = ${opts.type}`);
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const [rows, [{ n }], statusCounts] = await Promise.all([
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
        listedAt: listings.listedAt,
        street: properties.street,
        city: properties.city,
        state: properties.state,
        source: properties.source,
        agent: users.name,
        photo: sql<
          string | null
        >`(select url from property_media pm where pm.property_id = ${properties.id} order by sort_order limit 1)`,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(users, eq(users.id, listings.agentId))
      .where(where)
      .orderBy(desc(listings.createdAt))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .where(where),
    db.select({ status: listings.status, n: count() }).from(listings).groupBy(listings.status),
  ]);
  return {
    rows,
    total: n,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s.n])) as Record<
      string,
      number
    >,
  };
}

export async function listLeadsAdmin(opts: { stage?: string; page: number }) {
  const where =
    opts.stage && opts.stage !== "all" ? sql`${leads.stage} = ${opts.stage}` : undefined;
  const db = getDb();
  const [rows, [{ n }], stageCounts, sources] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        stage: leads.stage,
        source: leads.source,
        score: leads.score,
        createdAt: leads.createdAt,
        owner: users.name,
        listing: listings.title,
        listingSlug: listings.slug,
      })
      .from(leads)
      .innerJoin(users, eq(users.id, leads.ownerId))
      .leftJoin(listings, eq(listings.id, leads.listingId))
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(leads).where(where),
    db.select({ stage: leads.stage, n: count() }).from(leads).groupBy(leads.stage),
    db
      .select({ source: leads.source, n: count() })
      .from(leads)
      .groupBy(leads.source)
      .orderBy(desc(count())),
  ]);
  return {
    rows,
    total: n,
    stageCounts: Object.fromEntries(stageCounts.map((s) => [s.stage, s.n])) as Record<
      string,
      number
    >,
    sources,
  };
}

export async function listReviewsAdmin(status: string, page: number) {
  const where = status === "all" ? undefined : sql`${reviews.status} = ${status}`;
  const db = getDb();
  const [rows, [{ n }], counts] = await Promise.all([
    db
      .select({ r: reviews, agent: users.name, agentSlug: agentProfiles.slug })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.agentId))
      .leftJoin(agentProfiles, eq(agentProfiles.userId, reviews.agentId))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(reviews).where(where),
    db.select({ status: reviews.status, n: count() }).from(reviews).groupBy(reviews.status),
  ]);
  return {
    rows,
    total: n,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>,
  };
}

export async function listReportsAdmin(status: string) {
  const db = getDb();
  const rows = await db
    .select({ r: reports, reporter: users.name })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterId))
    .where(
      status === "all"
        ? undefined
        : status === "open"
          ? sql`${reports.status} in ('open','reviewing')`
          : sql`${reports.status} = ${status}`,
    )
    .orderBy(desc(reports.createdAt))
    .limit(100);
  // Resolve listing targets to titles for context.
  const listingIds = rows.filter((x) => x.r.targetType === "listing").map((x) => x.r.targetId);
  const titles = listingIds.length
    ? await db
        .select({ id: listings.id, title: listings.title, slug: listings.slug })
        .from(listings)
        .where(
          sql`${listings.id}::text in (${sql.join(
            listingIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
    : [];
  const byId = new Map(titles.map((t) => [t.id, t]));
  return rows.map((x) => ({
    ...x,
    listing: x.r.targetType === "listing" ? (byId.get(x.r.targetId) ?? null) : null,
  }));
}

export async function getAIStats() {
  const db = getDb();
  const [byFeature, recent, daily] = await Promise.all([
    db.execute<{
      feature: string;
      n: number;
      avgMs: number;
      modelShare: number;
      failures: number;
    }>(sql`
      select feature, count(*)::int n, avg(latency_ms)::int "avgMs",
        avg(case when provider <> 'rules' then 1 else 0 end)::float "modelShare",
        count(*) filter (where not success)::int failures
      from ai_requests where created_at > now() - interval '30 days' group by feature order by n desc`),
    db
      .select({ a: aiRequests, user: users.email })
      .from(aiRequests)
      .leftJoin(users, eq(users.id, aiRequests.userId))
      .orderBy(desc(aiRequests.createdAt))
      .limit(15),
    db.execute<{ day: string; n: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day, coalesce(x.n, 0)::int as n
      from generate_series(current_date - 13, current_date, interval '1 day') d
      left join (select date_trunc('day', created_at) as day, count(*) n from ai_requests where created_at > current_date - 14 group by 1) x on x.day = d
      order by d`),
  ]);
  return { byFeature: [...byFeature], recent, daily: [...daily] };
}

export async function listOutbound(channel: string, page: number) {
  const where = channel === "all" ? undefined : sql`${outboundMessages.channel} = ${channel}`;
  const db = getDb();
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(outboundMessages)
      .where(where)
      .orderBy(desc(outboundMessages.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(outboundMessages).where(where),
  ]);
  return { rows, total: n };
}

export async function getAnalytics(days: number) {
  const db = getDb();
  const since = sql`now() - make_interval(days => ${days})`;
  const [byType, topListings, searchCities, daily, funnel] = await Promise.all([
    db
      .select({ type: events.type, n: count() })
      .from(events)
      .where(gte(events.createdAt, since))
      .groupBy(events.type)
      .orderBy(desc(count())),
    db
      .select({
        id: listings.id,
        slug: listings.slug,
        title: listings.title,
        city: properties.city,
        views: count(),
      })
      .from(events)
      .innerJoin(listings, eq(listings.id, events.listingId))
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .where(and(eq(events.type, "listing_view"), gte(events.createdAt, since)))
      .groupBy(listings.id, listings.slug, listings.title, properties.city)
      .orderBy(desc(count()))
      .limit(10),
    db.execute<{ city: string; n: number }>(
      sql`select meta->>'city' as city, count(*)::int n from events where type = 'search' and meta ? 'city' and created_at > ${since} group by 1 order by 2 desc limit 8`,
    ),
    db.execute<{ day: string; views: number; inquiries: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
        coalesce(sum(case when e.type = 'listing_view' then 1 end), 0)::int views,
        coalesce(sum(case when e.type in ('inquiry','tour_request') then 1 end), 0)::int inquiries
      from generate_series(current_date - (${days} - 1), current_date, interval '1 day') d
      left join events e on date_trunc('day', e.created_at) = d
      group by d order by d`),
    db.execute<{ step: string; n: number }>(sql`
      select 'Viewed a home' step, count(distinct coalesce(user_id::text, anonymous_id))::int n from events where type = 'listing_view' and created_at > ${since}
      union all select 'Saved a home', count(distinct coalesce(user_id::text, anonymous_id))::int from events where type = 'favorite' and created_at > ${since}
      union all select 'Contacted an agent', count(distinct coalesce(user_id::text, anonymous_id))::int from events where type = 'inquiry' and created_at > ${since}
      union all select 'Requested a tour', count(distinct coalesce(user_id::text, anonymous_id))::int from events where type = 'tour_request' and created_at > ${since}`),
  ]);
  return {
    byType,
    topListings,
    searchCities: [...searchCities],
    daily: [...daily],
    funnel: [...funnel],
  };
}

export async function listSubscriptions(status: string, page: number) {
  const where = status === "all" ? undefined : sql`${subscriptions.status} = ${status}`;
  const db = getDb();
  const [rows, [{ n }], counts, planRows, paymentRows] = await Promise.all([
    db
      .select({
        s: subscriptions,
        email: users.email,
        name: users.name,
        plan: plans.name,
        planKey: plans.key,
        priceMonthly: plans.priceMonthly,
        priceAnnual: plans.priceAnnual,
      })
      .from(subscriptions)
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(where)
      .orderBy(desc(subscriptions.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(subscriptions).where(where),
    db
      .select({ status: subscriptions.status, n: count() })
      .from(subscriptions)
      .groupBy(subscriptions.status),
    db
      .select({ id: plans.id, name: plans.name, key: plans.key })
      .from(plans)
      .orderBy(plans.sortOrder),
    db
      .select({ p: payments, email: users.email })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .orderBy(desc(payments.createdAt))
      .limit(10),
  ]);
  return {
    rows,
    total: n,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>,
    plans: planRows,
    payments: paymentRows,
  };
}

export async function listFeaturesAdmin() {
  return getDb()
    .select()
    .from(features)
    .orderBy(features.category, features.sortOrder, features.name);
}

/** Every plan with its entitlements and live subscriber count. */
export async function listPlansAdmin() {
  const db = getDb();
  const [planRows, ents, subs] = await Promise.all([
    db.select().from(plans).orderBy(plans.sortOrder, plans.name),
    db.select().from(planEntitlements),
    db
      .select({ planId: subscriptions.planId, n: count() })
      .from(subscriptions)
      .where(sql`${subscriptions.status} in ('trialing','active','past_due')`)
      .groupBy(subscriptions.planId),
  ]);
  const subCount = new Map(subs.map((s) => [s.planId, s.n]));
  return planRows.map((p) => ({
    ...p,
    subscribers: subCount.get(p.id) ?? 0,
    entitlements: Object.fromEntries(
      ents
        .filter((e) => e.planId === p.id)
        .map((e) => [e.featureKey, { enabled: e.enabled, limit: e.limitValue }]),
    ) as Record<string, { enabled: boolean; limit: number | null }>,
  }));
}

export async function listFlagsAdmin() {
  return getDb().select().from(featureFlags).orderBy(featureFlags.key);
}

export async function listAudit(page: number) {
  const db = getDb();
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({ a: auditLogs, actor: users.email })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50)
      .offset((page - 1) * 50),
    db.select({ n: count() }).from(auditLogs),
  ]);
  return { rows, total: n };
}
