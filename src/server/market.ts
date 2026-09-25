import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export interface MarketSummary {
  city: string;
  state: string;
  listingType: "sale" | "rent";
  active: number;
  medianPrice: number | null;
  medianPpsf: number | null;
  medianDom: number | null;
  priceCutShare: number;
  closed90: number;
  medianClosePrice: number | null;
  saleToList: number | null;
}

export async function getMarketSummary(
  city: string,
  state: string,
  listingType: "sale" | "rent",
): Promise<MarketSummary> {
  const [row] = await getDb().execute<Omit<MarketSummary, "city" | "state" | "listingType">>(sql`
    with scoped as (
      select l.*, p.sqft from listings l join properties p on p.id = l.property_id
      where lower(p.city) = lower(${city}) and p.state = ${state} and l.listing_type = ${listingType}
    ), active as (select * from scoped where status in ('active','coming_soon')),
    closed as (select * from scoped where status in ('sold','rented') and closed_at > now() - interval '90 days')
    select
      (select count(*)::int from active) as "active",
      (select percentile_cont(0.5) within group (order by price)::int from active) as "medianPrice",
      (select percentile_cont(0.5) within group (order by price::float / nullif(sqft,0))::numeric(10,2)::float from active where sqft > 0) as "medianPpsf",
      (select percentile_cont(0.5) within group (order by extract(epoch from now() - listed_at) / 86400)::int from active) as "medianDom",
      (select coalesce(avg(case when exists (select 1 from price_history ph where ph.listing_id = a.id and ph.event = 'price_change') then 1 else 0 end), 0)::float from active a) as "priceCutShare",
      (select count(*)::int from closed) as "closed90",
      (select percentile_cont(0.5) within group (order by close_price)::int from closed) as "medianClosePrice",
      (select avg(close_price::float / nullif(price,0))::float from closed) as "saleToList"
  `);
  return { city, state, listingType, ...row };
}

export async function getNeighborhoodStats(
  city: string,
  state: string,
  listingType: "sale" | "rent",
) {
  return getDb().execute<{
    neighborhood: string;
    active: number;
    medianPrice: number;
    medianPpsf: number | null;
    medianBeds: number | null;
  }>(sql`
    select p.neighborhood,
      count(*)::int as "active",
      percentile_cont(0.5) within group (order by l.price)::int as "medianPrice",
      (percentile_cont(0.5) within group (order by l.price::float / nullif(p.sqft,0)))::numeric(10,2)::float as "medianPpsf",
      percentile_cont(0.5) within group (order by p.beds)::float as "medianBeds"
    from listings l join properties p on p.id = l.property_id
    where lower(p.city) = lower(${city}) and p.state = ${state} and l.listing_type = ${listingType}
      and l.status in ('active','coming_soon') and p.neighborhood is not null
    group by p.neighborhood order by "medianPrice" desc`);
}

/** Price distribution of active listings in fixed-width buckets. */
export async function getPriceDistribution(
  city: string,
  state: string,
  listingType: "sale" | "rent",
  buckets = 10,
) {
  const rows = await getDb().execute<{ price: number }>(sql`
    select l.price from listings l join properties p on p.id = l.property_id
    where lower(p.city) = lower(${city}) and p.state = ${state} and l.listing_type = ${listingType} and l.status in ('active','coming_soon')`);
  const prices = rows.map((r) => r.price).sort((a, b) => a - b);
  if (!prices.length) return [];
  // Trim the top 2% so one outlier doesn't flatten the histogram.
  const hi = prices[Math.floor(prices.length * 0.98)] ?? prices.at(-1)!;
  const lo = prices[0];
  const step = niceStep((hi - lo) / buckets);
  const start = Math.floor(lo / step) * step;
  const out: { from: number; to: number; count: number }[] = [];
  for (let from = start; from <= hi; from += step) out.push({ from, to: from + step, count: 0 });
  for (const p of prices) {
    const i = Math.min(out.length - 1, Math.max(0, Math.floor((p - start) / step)));
    out[i].count++;
  }
  return out;
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Monthly new listings and median list price (from price history). */
export async function getMonthlyTrend(city: string, state: string, listingType: "sale" | "rent") {
  return getDb().execute<{ month: string; newListings: number; medianPrice: number }>(sql`
    select to_char(date_trunc('month', ph.occurred_at), 'YYYY-MM') as "month",
      count(*)::int as "newListings",
      percentile_cont(0.5) within group (order by ph.price)::int as "medianPrice"
    from price_history ph join listings l on l.id = ph.listing_id join properties p on p.id = l.property_id
    where ph.event = 'listed' and lower(p.city) = lower(${city}) and p.state = ${state} and l.listing_type = ${listingType}
      and ph.occurred_at > now() - interval '12 months'
    group by 1 order by 1`);
}

export interface ValueEstimate {
  low: number;
  mid: number;
  high: number;
  ppsf: number;
  compCount: number;
  comps: {
    id: string;
    slug: string;
    street: string;
    neighborhood: string | null;
    price: number;
    sqft: number;
    beds: number | null;
    status: string;
  }[];
}

/**
 * Comparable-sales estimate: median $/sqft of similar nearby listings × size.
 * Deliberately simple and explainable — we show the comps it used.
 */
export async function estimateValue(input: {
  city: string;
  state: string;
  neighborhood?: string;
  sqft: number;
  beds: number;
  propertyType: string;
}): Promise<ValueEstimate | null> {
  const rows = await getDb().execute<ValueEstimate["comps"][number] & { ppsf: number }>(sql`
    select l.id, l.slug, p.street, p.neighborhood, coalesce(l.close_price, l.price) as price, p.sqft, p.beds, l.status,
      coalesce(l.close_price, l.price)::float / p.sqft as ppsf
    from listings l join properties p on p.id = l.property_id
    where l.listing_type = 'sale' and l.status in ('active','pending','sold') and p.sqft > 0
      and lower(p.city) = lower(${input.city}) and p.state = ${input.state}
      and p.property_type = ${input.propertyType}
      and p.beds between ${input.beds - 1} and ${input.beds + 1}
      and p.sqft between ${Math.round(input.sqft * 0.65)} and ${Math.round(input.sqft * 1.35)}
    order by (p.neighborhood = ${input.neighborhood ?? ""}) desc, abs(p.sqft - ${input.sqft}) asc
    limit 12`);
  if (rows.length < 3) return null;
  const ppsfs = rows.map((r) => r.ppsf).sort((a, b) => a - b);
  const q = (f: number) => ppsfs[Math.min(ppsfs.length - 1, Math.floor(f * (ppsfs.length - 1)))];
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return {
    low: round(q(0.25) * input.sqft),
    mid: round(q(0.5) * input.sqft),
    high: round(q(0.75) * input.sqft),
    ppsf: Math.round(q(0.5)),
    compCount: rows.length,
    comps: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      street: r.street,
      neighborhood: r.neighborhood,
      price: r.price,
      sqft: r.sqft,
      beds: r.beds,
      status: r.status,
    })),
  };
}
