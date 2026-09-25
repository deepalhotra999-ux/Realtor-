import type { Metadata } from "next";
import Link from "next/link";
import { Award, GitCompareArrows, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { summarizeComparison } from "@/server/ai/features";
import { getSearch } from "@/providers";
import { AMENITIES, PROPERTY_TYPE_LABELS, type AmenityKey } from "@/lib/domain";
import { daysSince, formatAcres, formatBaths, formatNumber, formatPrice } from "@/lib/format";
import { calculateMortgage, DEFAULT_RATE_PCT } from "@/lib/mortgage";
import type { ListingSummary } from "@/lib/listing-types";
import { CompareRemove, CompareSync } from "@/components/listing/compare-sync";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Compare homes" };

type Row = {
  label: string;
  value: (l: ListingSummary) => string;
  best?: (ls: ListingSummary[]) => string | null;
};

const minId = (ls: ListingSummary[], f: (l: ListingSummary) => number | null) => {
  let best: ListingSummary | null = null;
  let v = Infinity;
  for (const l of ls) {
    const x = f(l);
    if (x !== null && x < v) {
      v = x;
      best = l;
    }
  }
  return best?.id ?? null;
};

export default async function ComparePage(props: PageProps<"/compare">) {
  const sp = await props.searchParams;
  const ids =
    typeof sp.ids === "string"
      ? sp.ids
          .split(",")
          .filter((x) => /^[0-9a-f-]{36}$/.test(x))
          .slice(0, 4)
      : [];
  const items = ids.length ? await getSearch().byIds(ids) : [];
  const user = await getCurrentUser();
  let summary: Awaited<ReturnType<typeof summarizeComparison>> | null = null;
  if (items.length >= 2) {
    try {
      summary = await summarizeComparison(items, user?.id ?? null);
    } catch {
      summary = null;
    }
  }

  const rows: Row[] = [
    {
      label: "Price",
      value: (l) => formatPrice(l.price, l.listingType),
      best: (ls) => minId(ls, (l) => l.price),
    },
    {
      label: "Est. monthly cost",
      value: (l) =>
        l.listingType === "rent"
          ? formatPrice(l.price, "rent")
          : `${formatPrice(Math.round(calculateMortgage({ price: l.price, downPayment: l.price * 0.2, ratePct: DEFAULT_RATE_PCT, termYears: 30, hoaMonthly: l.hoaMonthly ?? 0 }).total))}/mo`,
    },
    {
      label: "Price / sqft",
      value: (l) => (l.sqft ? `$${Math.round(l.price / l.sqft)}` : "—"),
      best: (ls) => minId(ls, (l) => (l.sqft ? l.price / l.sqft : null)),
    },
    { label: "Home type", value: (l) => PROPERTY_TYPE_LABELS[l.propertyType] },
    {
      label: "Bedrooms",
      value: (l) => (l.beds === 0 ? "Studio" : String(l.beds ?? "—")),
      best: (ls) => minId(ls, (l) => (l.beds === null ? null : -l.beds)),
    },
    {
      label: "Bathrooms",
      value: (l) => formatBaths(l.baths),
      best: (ls) => minId(ls, (l) => (l.baths === null ? null : -l.baths)),
    },
    {
      label: "Living area",
      value: (l) => (l.sqft ? `${formatNumber(l.sqft)} sqft` : "—"),
      best: (ls) => minId(ls, (l) => (l.sqft ? -l.sqft : null)),
    },
    { label: "Lot", value: (l) => formatAcres(l.lotSqft) ?? "—" },
    {
      label: "Year built",
      value: (l) => String(l.yearBuilt ?? "—"),
      best: (ls) => minId(ls, (l) => (l.yearBuilt ? -l.yearBuilt : null)),
    },
    { label: "HOA", value: (l) => (l.hoaMonthly ? `$${l.hoaMonthly}/mo` : "None listed") },
    { label: "Days listed", value: (l) => String(daysSince(l.listedAt) ?? "—") },
    { label: "Neighborhood", value: (l) => `${l.neighborhood ?? "—"}, ${l.city}` },
  ];
  const allFeatures = [...new Set(items.flatMap((l) => l.features))].sort();

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
      <CompareSync urlIds={ids} />
      <h1 className="font-display text-4xl">Compare homes</h1>
      <p className="text-muted mt-2">
        Add up to four homes with the <GitCompareArrows className="inline size-4" /> button on any
        listing.
      </p>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<GitCompareArrows className="size-5" />}
            title="Nothing to compare yet"
            action={<ButtonLink href="/search">Browse homes</ButtonLink>}
          >
            Tap the compare icon on listing cards to line homes up side by side.
          </EmptyState>
        </div>
      ) : (
        <>
          {summary && summary.bullets.length ? (
            <div className="border-brand-200 bg-brand-50/70 mt-8 rounded-3xl border p-6">
              <p className="text-brand-700 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4" /> Comparison summary
              </p>
              {summary.narrative ? (
                <p className="text-ink mt-3 leading-relaxed">{summary.narrative}</p>
              ) : null}
              <ul className="text-ink-2 mt-3 space-y-1.5 text-sm">
                {summary.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="bg-brand-500 mt-2 size-1.5 shrink-0 rounded-full" />
                    {b}
                  </li>
                ))}
              </ul>
              <p className="text-muted mt-3 text-xs">
                Computed from listing data
                {summary.provider !== "rules" ? ` · phrased by ${summary.provider}` : ""}.
              </p>
            </div>
          ) : null}
          <div className="border-line bg-surface mt-8 overflow-x-auto rounded-3xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className="w-44 p-4" />
                  {items.map((l) => (
                    <th key={l.id} className="p-4 text-left align-top font-normal">
                      <div className="relative overflow-hidden rounded-2xl">
                        <CompareRemove id={l.id} />
                        <Link href={`/homes/${l.slug}`}>
                          {l.photoUrl ? (
                            <img
                              src={l.photoUrl}
                              alt=""
                              className="aspect-[4/3] w-full object-cover"
                            />
                          ) : (
                            <div className="bg-paper-2 aspect-[4/3]" />
                          )}
                        </Link>
                      </div>
                      <Link
                        href={`/homes/${l.slug}`}
                        className="mt-3 block font-semibold hover:underline"
                      >
                        {l.street}
                      </Link>
                      <p className="text-muted text-xs">
                        {l.city}, {l.state}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const bestId = items.length > 1 ? r.best?.(items) : null;
                  return (
                    <tr key={r.label} className="border-line border-t">
                      <th scope="row" className="text-muted p-4 text-left font-medium">
                        {r.label}
                      </th>
                      {items.map((l) => (
                        <td
                          key={l.id}
                          className={`tabular p-4 ${bestId === l.id ? "text-brand-700 font-semibold" : ""}`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {r.value(l)}
                            {bestId === l.id ? (
                              <Award className="size-3.5" aria-label="Best" />
                            ) : null}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-line border-t">
                  <th scope="row" className="text-muted p-4 text-left align-top font-medium">
                    Features
                  </th>
                  {items.map((l) => (
                    <td key={l.id} className="p-4 align-top">
                      <ul className="space-y-1">
                        {allFeatures.map((f) => (
                          <li
                            key={f}
                            className={
                              l.features.includes(f) ? "text-ink" : "text-subtle line-through"
                            }
                          >
                            {AMENITIES[f as AmenityKey] ?? f}
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
