"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { CompsMap, type CompPin } from "@/components/map";
import type { MapConfig } from "@/providers/map/types";
import type { ListingType } from "@/lib/domain";
import { formatBaths, formatNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";

export interface CompRow {
  id: string;
  slug: string;
  street: string;
  city: string;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
}

export interface CompsSubject {
  id: string;
  price: number;
  listingType: ListingType;
  street: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  latitude: number;
  longitude: number;
}

interface Props {
  subject: CompsSubject;
  comps: CompRow[];
  mapConfig: MapConfig;
}

function Delta({ compPrice, subjectPrice }: { compPrice: number; subjectPrice: number }) {
  const delta = compPrice - subjectPrice;
  if (delta === 0)
    return <span className="text-muted">Same price</span>;
  const pct = Math.abs((delta / subjectPrice) * 100);
  const cheaper = delta < 0;
  return (
    <span className={cn("font-medium", cheaper ? "text-green-700" : "text-red-700")}>
      {cheaper ? "−" : "+"}
      {formatPrice(Math.abs(delta))} ({pct < 0.05 ? "<0.1" : pct.toFixed(0)}%)
    </span>
  );
}

export function CompsSection({ subject, comps, mapConfig }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pins: CompPin[] = useMemo(
    () =>
      comps.map((c) => ({
        id: c.id,
        slug: c.slug,
        street: c.street,
        lat: c.latitude,
        lng: c.longitude,
        price: c.price,
        listingType: subject.listingType,
        beds: c.beds,
        baths: c.baths,
        sqft: c.sqft,
        distanceKm: c.distanceKm,
      })),
    [comps, subject.listingType],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });

  const compareHref =
    selected.size > 0
      ? `/compare?ids=${[subject.id, ...selected].join(",")}`
      : null;

  return (
    <section aria-label="Comparable homes">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Comparable homes</h2>
          <p className="text-muted mt-1 max-w-xl text-sm">
            {subject.listingType === "rent" ? "Rentals" : "Homes for sale"} within 8 km, priced
            within ±25% of this home
            {subject.beds !== null ? `, with a similar bedroom count` : ""}. Pin colors are
            relative to this home&apos;s price.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {(
            [
              ["#15803d", "Cheaper"],
              ["#b45309", "Similar (±5%)"],
              ["#b91c1c", "Pricier"],
            ] as const
          ).map(([color, label]) => (
            <span key={label} className="text-muted flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="border-line relative isolate mt-5 h-96 overflow-hidden rounded-3xl border">
        <CompsMap
          config={mapConfig}
          subject={{
            lat: subject.latitude,
            lng: subject.longitude,
            price: subject.price,
            listingType: subject.listingType,
            label: subject.street,
          }}
          comps={pins}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </div>

      <div className="border-line bg-surface mt-5 overflow-x-auto rounded-3xl border">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-muted text-left text-xs">
              <th className="w-10 px-4 py-3 font-medium">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-2 py-3 font-medium">Comparable</th>
              <th className="px-2 py-3 text-right font-medium">Distance</th>
              <th className="px-2 py-3 text-right font-medium">Price</th>
              <th className="px-2 py-3 text-right font-medium">vs this home</th>
              <th className="px-2 py-3 text-right font-medium">$/sqft</th>
              <th className="px-2 py-3 text-right font-medium">Beds</th>
              <th className="px-2 py-3 text-right font-medium">Baths</th>
              <th className="px-2 py-3 text-right font-medium">Sqft</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr
                key={c.id}
                className={cn(
                  "border-line border-t transition-colors",
                  activeId === c.id && "bg-brand-50/60",
                )}
                onMouseEnter={() => setActiveId(c.id)}
                onMouseLeave={() => setActiveId(null)}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    aria-label={`Select ${c.street} to compare`}
                    className="accent-brand-600 size-4"
                  />
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={`/homes/${c.slug}`}
                    className="font-semibold hover:underline"
                  >
                    {c.street}
                  </Link>
                  <p className="text-muted text-xs">{c.city}</p>
                </td>
                <td className="tabular px-2 py-3 text-right">{c.distanceKm.toFixed(1)} km</td>
                <td className="tabular px-2 py-3 text-right font-semibold">
                  {formatPrice(c.price, subject.listingType)}
                </td>
                <td className="tabular px-2 py-3 text-right">
                  <Delta compPrice={c.price} subjectPrice={subject.price} />
                </td>
                <td className="tabular px-2 py-3 text-right">
                  {c.sqft ? `$${Math.round(c.price / c.sqft)}` : "—"}
                </td>
                <td className="tabular px-2 py-3 text-right">
                  {c.beds === 0 ? "Studio" : (c.beds ?? "—")}
                </td>
                <td className="tabular px-2 py-3 text-right">{formatBaths(c.baths)}</td>
                <td className="tabular px-2 py-3 text-right">{formatNumber(c.sqft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {compareHref ? (
          <ButtonLink href={compareHref}>
            <GitCompareArrows className="size-4" /> Compare selected ({selected.size})
          </ButtonLink>
        ) : (
          <span className="text-muted text-sm">
            Tick up to three comparables to line them up against this home.
          </span>
        )}
        <p className="text-subtle ml-auto text-xs">
          Distances are straight-line · prices at time of viewing
        </p>
      </div>
    </section>
  );
}
