"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  BellPlus,
  ChevronLeft,
  ChevronRight,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { MapConfig } from "@/providers/map/types";
import type { MapPin as Pin, SearchResults } from "@/providers/search/types";
import { toSearchParams, type BBox, type SearchQuery } from "@/lib/search/query";
import { formatCompactPrice, formatNumber } from "@/lib/format";
import { looksLikeNaturalLanguage } from "@/lib/ai/nl-parser";
import { cn } from "@/lib/utils";
import { SearchMap } from "@/components/map";
import { ListingCard } from "@/components/listing/listing-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/misc";
import { Field, Input, Select } from "@/components/ui/input";
import { saveSearchAction, type FormState } from "@/server/actions/marketplace";
import {
  BedsBathsFilter,
  HomeTypeFilter,
  MoreFilters,
  PriceFilter,
  SortSelect,
  type QueryPatch,
} from "./filters";
import { useSuggestions } from "./hero-search";

export interface Interpretation {
  text: string;
  chips: string[];
  usedModel: boolean;
}

interface Props {
  query: SearchQuery;
  place: string | null;
  results: SearchResults;
  pins: Pin[];
  favoriteIds: string[];
  mapConfig: MapConfig;
  fallbackCenter: { lat: number; lng: number; zoom: number };
  interpretation: Interpretation | null;
  signedIn: boolean;
}

function PlaceSearch({
  place,
  listingType,
}: {
  place: string | null;
  listingType: SearchQuery["listingType"];
}) {
  const router = useRouter();
  const [value, setValue] = useState(place ?? "");
  const [open, setOpen] = useState(false);
  const suggestions = useSuggestions(value);
  const go = (href: string) => {
    setOpen(false);
    router.push(listingType === "rent" && href.startsWith("/search") ? `${href}&type=rent` : href);
  };
  return (
    <form
      className="relative w-full sm:w-80"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        if (!looksLikeNaturalLanguage(v) && suggestions[0]?.kind === "place")
          return go(suggestions[0].href);
        const p = new URLSearchParams({ [looksLikeNaturalLanguage(v) ? "q" : "place"]: v });
        go(`/search?${p}`);
      }}
    >
      <Search className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Place, address, or describe it…"
        aria-label="Search location"
        className="border-line bg-surface focus:border-brand-400 focus:ring-brand-100 h-10 w-full rounded-full border pr-4 pl-10 text-sm outline-none focus:ring-4"
      />
      {open && suggestions.length ? (
        <ul className="border-line bg-surface shadow-pop absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border p-1">
          {suggestions.map((s) => (
            <li key={s.href}>
              <button
                type="button"
                onMouseDown={() => go(s.href)}
                className="hover:bg-paper flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm"
              >
                <MapPin className="text-brand-600 size-4 shrink-0" />
                <span className="truncate">{s.label}</span>
                {s.sublabel ? (
                  <span className="text-muted ml-auto shrink-0 text-xs">{s.sublabel}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

function SaveSearchButton({
  query,
  signedIn,
  place,
}: {
  query: SearchQuery;
  signedIn: boolean;
  place: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(saveSearchAction, undefined);
  const qs = toSearchParams(query).toString();
  if (!signedIn) {
    return (
      <ButtonLink
        href={`/login?next=${encodeURIComponent(`/search?${qs}`)}`}
        variant="secondary"
        size="sm"
      >
        <BellPlus className="size-4" /> Save search
      </ButtonLink>
    );
  }
  const suggested = [
    place?.split(",")[0],
    query.minBeds ? `${query.minBeds}+ bd` : null,
    query.maxPrice ? `under ${formatCompactPrice(query.maxPrice, query.listingType)}` : null,
    query.listingType === "rent" ? "rentals" : "homes",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <BellPlus className="size-4" /> Save search
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Save this search">
        {state?.ok ? (
          <div className="space-y-4">
            <p className="text-ink-2 text-sm">{state.message}</p>
            <div className="flex gap-2">
              <ButtonLink href="/saved-searches" size="sm">
                View saved searches
              </ButtonLink>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="query" value={qs} />
            <Field label="Name" htmlFor="ss-name">
              <Input id="ss-name" name="name" defaultValue={suggested} required maxLength={80} />
            </Field>
            <Field label="Email me new matches" htmlFor="ss-freq">
              <Select id="ss-freq" name="frequency" defaultValue="daily">
                <option value="instant">As soon as they&apos;re listed</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
                <option value="off">Don&apos;t email me</option>
              </Select>
            </Field>
            {state?.error ? <p className="text-clay-600 text-sm">{state.error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving…" : "Save search"}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

export function SearchView({
  query,
  place,
  results,
  pins,
  favoriteIds,
  mapConfig,
  fallbackCenter,
  interpretation,
  signedIn,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hovered, setHovered] = useState<string | null>(null);
  const [followMap, setFollowMap] = useState(true);
  const [mobileMap, setMobileMap] = useState(false);
  const favs = new Set(favoriteIds);

  const navigate = (patch: QueryPatch, opts: { keepPlace?: boolean } = { keepPlace: true }) => {
    const next = { ...query, ...patch, page: patch.page ?? 1 };
    const params = toSearchParams(next);
    if (place && opts.keepPlace !== false) params.set("place", place);
    startTransition(() => router.replace(`/search?${params}`, { scroll: false }));
  };

  const onBounds = (bbox: BBox) => {
    if (!followMap) return;
    navigate({ bbox }, { keepPlace: false });
  };

  const totalPages = Math.max(1, Math.ceil(results.total / results.pageSize));
  const heading = place
    ? place.split(",").slice(0, 2).join(",")
    : query.bbox
      ? "this map area"
      : "all markets";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Filter bar */}
      <div className="border-line bg-paper/95 relative z-30 border-b backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <PlaceSearch key={place ?? ""} place={place} listingType={query.listingType} />
          <div className="border-line bg-surface flex rounded-full border p-0.5">
            {(["sale", "rent"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  navigate({
                    listingType: t,
                    minPrice: undefined,
                    maxPrice: undefined,
                    propertyTypes: [],
                  })
                }
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  query.listingType === t ? "bg-brand-600 text-white" : "text-ink-2 hover:text-ink",
                )}
              >
                {t === "sale" ? "Buy" : "Rent"}
              </button>
            ))}
          </div>
          <div className="-mx-1 flex max-w-full min-w-0 scrollbar-none gap-2 overflow-x-auto px-1 sm:overflow-visible">
            <PriceFilter q={query} onChange={navigate} />
            <BedsBathsFilter q={query} onChange={navigate} />
            <HomeTypeFilter q={query} onChange={navigate} />
            <MoreFilters q={query} onChange={navigate} />
          </div>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <SaveSearchButton query={query} signedIn={signedIn} place={place} />
          </div>
        </div>
        {interpretation ? (
          <div className="border-line bg-brand-50/60 flex flex-wrap items-center gap-2 border-t px-4 py-2.5 sm:px-6">
            <Sparkles className="text-brand-600 size-4" />
            <span className="text-ink-2 text-sm">
              Showing results for{" "}
              <span className="text-ink font-medium">“{interpretation.text}”</span>
            </span>
            {interpretation.chips.map((c) => (
              <span
                key={c}
                className="text-brand-700 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium capitalize shadow-sm"
              >
                {c}
              </span>
            ))}
            <span className="text-muted text-xs">
              {interpretation.usedModel
                ? "· interpreted with local AI"
                : "· adjust any filter above"}
            </span>
            <Link
              href="/search"
              className="text-muted hover:text-ink ml-auto inline-flex items-center gap-1 text-xs font-medium"
            >
              <X className="size-3.5" /> Clear
            </Link>
          </div>
        ) : null}
      </div>

      {/* List + map */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section
          className={cn("min-h-0 overflow-y-auto", mobileMap && "hidden lg:block")}
          aria-busy={pending}
        >
          <div className="px-4 py-5 sm:px-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {query.listingType === "rent" ? "Rentals" : "Homes for sale"} in {heading}
                </h1>
                <p className="text-muted tabular mt-0.5 text-sm">
                  {formatNumber(results.total)} result{results.total === 1 ? "" : "s"}
                  {results.stats.medianPrice
                    ? ` · median ${formatCompactPrice(results.stats.medianPrice, query.listingType)}${query.listingType === "rent" ? "/mo" : ""}`
                    : ""}
                </p>
              </div>
              <SortSelect q={query} onChange={navigate} />
            </div>
            <div className={cn("transition-opacity", pending && "opacity-50")}>
              {results.items.length === 0 ? (
                <EmptyState icon={<Search className="size-5" />} title="No homes match all of that">
                  Try zooming out, removing a filter, or widening your price range.
                  <div className="mt-5">
                    <ButtonLink
                      href={query.listingType === "rent" ? "/search?type=rent" : "/search"}
                      variant="secondary"
                      size="sm"
                    >
                      Reset filters
                    </ButtonLink>
                  </div>
                </EmptyState>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {results.items.map((l, i) => (
                    <div
                      key={l.id}
                      onMouseEnter={() => setHovered(l.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <ListingCard
                        listing={l}
                        favorited={favs.has(l.id)}
                        highlighted={hovered === l.id}
                        priority={i < 4}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {totalPages > 1 ? (
              <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  disabled={query.page <= 1}
                  onClick={() => navigate({ page: query.page - 1 })}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-muted tabular px-2 text-sm">
                  Page {query.page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  disabled={query.page >= totalPages}
                  onClick={() => navigate({ page: query.page + 1 })}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </nav>
            ) : null}
            <p className="text-subtle mt-8 text-center text-xs">
              Demo listings are fictional · Search took {results.tookMs} ms
            </p>
          </div>
        </section>
        <section
          className={cn("relative isolate min-h-0", mobileMap ? "block" : "hidden lg:block")}
        >
          <SearchMap
            key={place ?? "area"}
            config={mapConfig}
            pins={pins}
            bbox={query.bbox}
            fallbackCenter={fallbackCenter}
            hoveredId={hovered}
            onHover={setHovered}
            onBoundsChange={onBounds}
          />
          <label className="bg-surface shadow-card absolute top-3 left-1/2 z-[500] flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium">
            <input
              type="checkbox"
              className="accent-brand-600 size-3.5"
              checked={followMap}
              onChange={(e) => setFollowMap(e.target.checked)}
            />
            Search as I move the map
          </label>
          {pins.length >= 1500 ? (
            <p className="bg-ink/80 absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-full px-3 py-1.5 text-xs text-white">
              Zoom in to see all homes
            </p>
          ) : null}
        </section>
      </div>

      {/* Mobile map/list toggle */}
      <button
        type="button"
        onClick={() => setMobileMap((m) => !m)}
        className="bg-ink shadow-pop fixed bottom-6 left-1/2 z-[600] inline-flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white lg:hidden"
      >
        {mobileMap ? <List className="size-4" /> : <MapIcon className="size-4" />}
        {mobileMap ? "List" : "Map"}
      </button>
    </div>
  );
}
