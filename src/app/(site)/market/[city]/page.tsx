import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  getMarketSummary,
  getMonthlyTrend,
  getNeighborhoodStats,
  getPriceDistribution,
} from "@/server/market";
import { EXTRA_CITIES, METROS } from "@/lib/geo/places";
import { slugify } from "@/lib/slug";
import { formatCompactPrice, formatPrice } from "@/lib/format";
import { ColumnChart, LineChart } from "@/components/charts";
import { Stat } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function resolveCity(slug: string) {
  return [...METROS, ...EXTRA_CITIES].find((c) => slugify(`${c.city} ${c.state}`) === slug) ?? null;
}

export async function generateMetadata(props: PageProps<"/market/[city]">): Promise<Metadata> {
  const c = resolveCity((await props.params).city);
  return { title: c ? `${c.city}, ${c.state} housing market` : "Market" };
}

export default async function CityMarketPage(props: PageProps<"/market/[city]">) {
  const { city: slug } = await props.params;
  const { type } = await props.searchParams;
  const c = resolveCity(slug);
  if (!c) notFound();
  const listingType = type === "rent" ? "rent" : "sale";
  const [summary, hoods, dist, trend] = await Promise.all([
    getMarketSummary(c.city, c.state, listingType),
    getNeighborhoodStats(c.city, c.state, listingType),
    getPriceDistribution(c.city, c.state, listingType),
    getMonthlyTrend(c.city, c.state, listingType),
  ]);
  const rent = listingType === "rent";
  const money = (n: number | null) =>
    n === null ? "—" : rent ? `$${n.toLocaleString("en-US")}` : formatCompactPrice(n);
  const monthLabel = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const searchHref = `/search?place=${encodeURIComponent(`${c.city}, ${c.state}`)}${rent ? "&type=rent" : ""}`;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
      <Link href="/market" className="text-muted hover:text-ink text-sm">
        ← All markets
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">
            {c.city}, {c.state}
          </h1>
          <p className="text-muted mt-2">
            {rent ? "Rental" : "For-sale"} market snapshot · live from Dwellwise listings (demo
            data)
          </p>
        </div>
        <div className="border-line bg-surface flex rounded-full border p-1">
          {(["sale", "rent"] as const).map((t) => (
            <Link
              key={t}
              href={`/market/${slug}${t === "rent" ? "?type=rent" : ""}`}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium",
                listingType === t ? "bg-brand-600 text-white" : "text-ink-2",
              )}
            >
              {t === "sale" ? "For sale" : "Rentals"}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={rent ? "Median rent" : "Median list price"}
          value={money(summary.medianPrice)}
          hint={`${summary.active} active listings`}
        />
        <Stat
          label={rent ? "Median rent / sqft" : "Median $ / sqft"}
          value={
            summary.medianPpsf
              ? `$${rent ? summary.medianPpsf.toFixed(2) : Math.round(summary.medianPpsf)}`
              : "—"
          }
        />
        <Stat
          label="Median days listed"
          value={summary.medianDom ?? "—"}
          hint={`${Math.round(summary.priceCutShare * 100)}% have cut their price`}
        />
        <Stat
          label={rent ? "Leased (90 days)" : "Sold (90 days)"}
          value={summary.closed90}
          hint={
            summary.saleToList
              ? `${(summary.saleToList * 100).toFixed(1)}% of list price · median ${money(summary.medianClosePrice)}`
              : "Not enough closed data"
          }
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {dist.length ? (
          <ColumnChart
            title="Active listings by price"
            subtitle={rent ? "Monthly rent, bucketed" : "List price, bucketed (top 2% trimmed)"}
            valueLabel="Listings"
            data={dist.map((d) => ({
              label: money(d.from),
              value: d.count,
              detail: `${money(d.from)} – ${money(d.to)}`,
            }))}
          />
        ) : null}
        {trend.length > 1 ? (
          <LineChart
            title="Median list price of new listings"
            subtitle="By month listed"
            valueLabel="Median price"
            unit={rent ? "usdRent" : "usd"}
            data={trend.map((t) => ({
              label: monthLabel(t.month),
              value: t.medianPrice,
              detail: `${monthLabel(t.month)} · ${t.newListings} new listings`,
            }))}
          />
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Neighborhoods</h2>
        <div className="border-line bg-surface mt-4 overflow-x-auto rounded-3xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-paper text-muted text-left text-xs">
              <tr>
                <th className="px-5 py-3 font-medium">Neighborhood</th>
                <th className="px-5 py-3 text-right font-medium">Active</th>
                <th className="px-5 py-3 text-right font-medium">
                  Median {rent ? "rent" : "price"}
                </th>
                <th className="px-5 py-3 text-right font-medium">$ / sqft</th>
                <th className="px-5 py-3 text-right font-medium">Median beds</th>
              </tr>
            </thead>
            <tbody>
              {hoods.map((h) => (
                <tr key={h.neighborhood} className="border-line border-t">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/search?place=${encodeURIComponent(`${h.neighborhood}, ${c.city}, ${c.state}`)}${rent ? "&type=rent" : ""}`}
                      className="font-medium hover:underline"
                    >
                      {h.neighborhood}
                    </Link>
                  </td>
                  <td className="tabular px-5 py-3.5 text-right">{h.active}</td>
                  <td className="tabular px-5 py-3.5 text-right">
                    {rent ? formatPrice(h.medianPrice) : formatCompactPrice(h.medianPrice)}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right">
                    {h.medianPpsf
                      ? `$${rent ? h.medianPpsf.toFixed(2) : Math.round(h.medianPpsf)}`
                      : "—"}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right">{h.medianBeds ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10">
        <ButtonLink href={searchHref} size="lg">
          Browse {summary.active} {rent ? "rentals" : "homes"} in {c.city}{" "}
          <ArrowRight className="size-4" />
        </ButtonLink>
      </div>
    </div>
  );
}
