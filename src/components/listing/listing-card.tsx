import Link from "next/link";
import { Calendar, TrendingDown } from "lucide-react";
import type { ListingSummary } from "@/lib/listing-types";
import { PROPERTY_TYPE_LABELS } from "@/lib/domain";
import {
  daysSince,
  formatBaths,
  formatCompactPrice,
  formatNumber,
  formatPrice,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/misc";
import { FavoriteButton } from "./favorite-button";
import { CompareToggle } from "./compare-toggle";

export function ListingFacts({ l, className }: { l: ListingSummary; className?: string }) {
  if (l.propertyType === "land") {
    return (
      <p className={cn("text-ink-2 text-sm", className)}>
        {l.lotSqft ? `${(l.lotSqft / 43560).toFixed(2)} acre lot` : "Land"}
      </p>
    );
  }
  return (
    <p className={cn("text-ink-2 tabular flex items-center gap-1.5 text-sm", className)}>
      <span>
        <b className="text-ink font-semibold">{l.beds === 0 ? "Studio" : (l.beds ?? "—")}</b>
        {l.beds === 0 ? "" : " bd"}
      </span>
      <span className="text-line-strong">·</span>
      <span>
        <b className="text-ink font-semibold">{formatBaths(l.baths)}</b> ba
      </span>
      {l.sqft ? (
        <>
          <span className="text-line-strong">·</span>
          <span>
            <b className="text-ink font-semibold">{formatNumber(l.sqft)}</b> sqft
          </span>
        </>
      ) : null}
    </p>
  );
}

export function listingBadges(l: ListingSummary) {
  const badges: {
    label: string;
    tone: "brand" | "clay" | "gold" | "dark" | "white";
    icon?: "cut" | "open";
  }[] = [];
  const age = daysSince(l.listedAt);
  if (l.status === "coming_soon") badges.push({ label: "Coming soon", tone: "dark" });
  else if (age !== null && age <= 7) badges.push({ label: "New", tone: "brand" });
  if (l.priceCut)
    badges.push({
      label: `${formatCompactPrice(l.priceCut, l.listingType)} price cut`,
      tone: "clay",
      icon: "cut",
    });
  if (l.nextOpenHouse) badges.push({ label: "Open house", tone: "white", icon: "open" });
  if (l.isFeatured) badges.push({ label: "Featured", tone: "gold" });
  return badges.slice(0, 2);
}

export function ListingCard({
  listing: l,
  favorited = false,
  highlighted = false,
  priority = false,
  compact = false,
}: {
  listing: ListingSummary;
  favorited?: boolean;
  highlighted?: boolean;
  priority?: boolean;
  compact?: boolean;
}) {
  const badges = listingBadges(l);
  return (
    <article
      className={cn(
        "group bg-surface relative overflow-hidden rounded-2xl border transition duration-200",
        highlighted
          ? "border-brand-400 shadow-lift ring-brand-100 ring-4"
          : "border-line shadow-card hover:shadow-lift hover:-translate-y-0.5",
      )}
    >
      <Link
        href={`/homes/${l.slug}`}
        className="absolute inset-0 z-10"
        aria-label={`${l.title}, ${formatPrice(l.price, l.listingType)}`}
      />
      <div
        className={cn(
          "bg-paper-2 relative overflow-hidden",
          compact ? "aspect-[16/10]" : "aspect-[4/3]",
        )}
      >
        {l.photoUrl ? (
          <img
            src={l.photoUrl}
            alt=""
            loading={priority ? "eager" : "lazy"}
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex gap-1.5 p-3">
          {badges.map((b) => (
            <Badge key={b.label} tone={b.tone} className="shadow-sm">
              {b.icon === "cut" ? (
                <TrendingDown className="size-3" />
              ) : b.icon === "open" ? (
                <Calendar className="size-3" />
              ) : null}
              {b.label}
            </Badge>
          ))}
        </div>
        <div className="absolute top-3 right-3 z-20 flex gap-1.5">
          <CompareToggle listingId={l.id} />
          <FavoriteButton listingId={l.id} initial={favorited} />
        </div>
        {l.photoCount > 1 ? (
          <span className="bg-ink/60 pointer-events-none absolute right-3 bottom-3 rounded-full px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {l.photoCount} photos
          </span>
        ) : null}
      </div>
      <div className={cn("space-y-1", compact ? "p-3" : "p-4")}>
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "text-ink tabular font-semibold tracking-tight",
              compact ? "text-lg" : "text-xl",
            )}
          >
            {formatPrice(l.price, l.listingType)}
          </p>
          <span className="text-muted shrink-0 text-xs">
            {PROPERTY_TYPE_LABELS[l.propertyType]}
          </span>
        </div>
        <ListingFacts l={l} />
        <p className="text-muted truncate text-sm">
          {l.street}
          {l.unit ? ` ${l.unit}` : ""}, {l.neighborhood ? `${l.neighborhood}, ` : ""}
          {l.city}, {l.state}
        </p>
        {!compact && l.brokerageName ? (
          <p className="text-subtle truncate pt-1 text-[11px]">{l.brokerageName}</p>
        ) : null}
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="border-line bg-surface overflow-hidden rounded-2xl border">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-6 w-32 rounded-md" />
        <div className="skeleton h-4 w-40 rounded-md" />
        <div className="skeleton h-4 w-56 rounded-md" />
      </div>
    </div>
  );
}
