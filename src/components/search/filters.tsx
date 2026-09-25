"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  AMENITIES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  type AmenityKey,
  type PropertyType,
} from "@/lib/domain";
import { activeFilterCount, SORT_LABELS, SORTS, type SearchQuery } from "@/lib/search/query";
import { formatCompactPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Popover, Segmented } from "@/components/ui/popover";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";

export type QueryPatch = Partial<SearchQuery>;

const SALE_PRICES = [
  100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 750_000, 1_000_000, 1_250_000, 1_500_000,
  2_000_000, 3_000_000,
];
const RENT_PRICES = [750, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000, 5000, 7500];

function priceLabel(q: SearchQuery) {
  const f = (n: number) => formatCompactPrice(n, q.listingType);
  if (q.minPrice !== undefined && q.maxPrice !== undefined)
    return `${f(q.minPrice)}–${f(q.maxPrice)}`;
  if (q.maxPrice !== undefined) return `Up to ${f(q.maxPrice)}`;
  if (q.minPrice !== undefined) return `${f(q.minPrice)}+`;
  return "Price";
}

export function PriceFilter({
  q,
  onChange,
}: {
  q: SearchQuery;
  onChange: (p: QueryPatch) => void;
}) {
  const opts = q.listingType === "rent" ? RENT_PRICES : SALE_PRICES;
  const f = (n: number) =>
    `${formatCompactPrice(n, q.listingType)}${q.listingType === "rent" ? "/mo" : ""}`;
  return (
    <Popover label={priceLabel(q)} active={q.minPrice !== undefined || q.maxPrice !== undefined}>
      {(close) => (
        <div className="w-72 max-w-full">
          <p className="mb-3 text-sm font-semibold">
            {q.listingType === "rent" ? "Monthly rent" : "Price range"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Select
              aria-label="Minimum price"
              value={q.minPrice ?? ""}
              onChange={(e) =>
                onChange({ minPrice: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">No min</option>
              {opts.map((o) => (
                <option key={o} value={o}>
                  {f(o)}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Maximum price"
              value={q.maxPrice ?? ""}
              onChange={(e) =>
                onChange({ maxPrice: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">No max</option>
              {opts.map((o) => (
                <option key={o} value={o}>
                  {f(o)}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-4 flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ minPrice: undefined, maxPrice: undefined })}
            >
              Reset
            </Button>
            <Button size="sm" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

const BED_OPTS = [
  { value: undefined, label: "Any" },
  { value: 0, label: "Studio+" },
  { value: 1, label: "1+" },
  { value: 2, label: "2+" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
  { value: 5, label: "5+" },
];
const BATH_OPTS = [
  { value: undefined, label: "Any" },
  { value: 1, label: "1+" },
  { value: 1.5, label: "1.5+" },
  { value: 2, label: "2+" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
];

export function BedsBathsFilter({
  q,
  onChange,
}: {
  q: SearchQuery;
  onChange: (p: QueryPatch) => void;
}) {
  const label =
    q.minBeds !== undefined || q.minBaths !== undefined
      ? [
          q.minBeds !== undefined ? `${q.minBeds}+ bd` : null,
          q.minBaths !== undefined ? `${q.minBaths}+ ba` : null,
        ]
          .filter(Boolean)
          .join(", ")
      : "Beds & baths";
  return (
    <Popover label={label} active={q.minBeds !== undefined || q.minBaths !== undefined}>
      {(close) => (
        <div className="w-[22rem] max-w-full space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Bedrooms</p>
            <Segmented
              options={BED_OPTS}
              value={q.minBeds}
              onChange={(v) => onChange({ minBeds: v })}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Bathrooms</p>
            <Segmented
              options={BATH_OPTS}
              value={q.minBaths}
              onChange={(v) => onChange({ minBaths: v })}
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

export function HomeTypeFilter({
  q,
  onChange,
}: {
  q: SearchQuery;
  onChange: (p: QueryPatch) => void;
}) {
  const types = PROPERTY_TYPES.filter((t) =>
    q.listingType === "rent" ? t !== "land" && t !== "multi_family" : t !== "apartment",
  );
  const toggle = (t: PropertyType) =>
    onChange({
      propertyTypes: q.propertyTypes.includes(t)
        ? q.propertyTypes.filter((x) => x !== t)
        : [...q.propertyTypes, t],
    });
  const label =
    q.propertyTypes.length === 1
      ? PROPERTY_TYPE_LABELS[q.propertyTypes[0]]
      : q.propertyTypes.length
        ? `${q.propertyTypes.length} home types`
        : "Home type";
  return (
    <Popover label={label} active={q.propertyTypes.length > 0}>
      {(close) => (
        <div className="w-64 max-w-full">
          <p className="mb-3 text-sm font-semibold">Home type</p>
          <div className="grid gap-1">
            {types.map((t) => (
              <label
                key={t}
                className="hover:bg-paper flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="accent-brand-600 size-4"
                  checked={q.propertyTypes.includes(t)}
                  onChange={() => toggle(t)}
                />
                {PROPERTY_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-between">
            <Button variant="ghost" size="sm" onClick={() => onChange({ propertyTypes: [] })}>
              Reset
            </Button>
            <Button size="sm" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

const POPULAR_AMENITIES: AmenityKey[] = [
  "garage",
  "pool",
  "home_office",
  "fenced_yard",
  "in_unit_laundry",
  "central_air",
  "ev_charger",
  "fireplace",
  "balcony",
  "gym",
  "solar",
  "basement",
  "wheelchair_accessible",
  "hardwood_floors",
  "open_floor_plan",
  "rooftop_deck",
  "walk_in_closet",
  "chefs_kitchen",
  "patio",
  "city_view",
  "mountain_view",
  "doorman",
  "elevator",
  "smart_home",
];

export function MoreFilters({
  q,
  onChange,
}: {
  q: SearchQuery;
  onChange: (p: QueryPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QueryPatch>({});
  const view = { ...q, ...draft };
  const extra = activeFilterCount({
    ...q,
    minPrice: undefined,
    maxPrice: undefined,
    minBeds: undefined,
    minBaths: undefined,
    propertyTypes: [],
  });
  const set = (p: QueryPatch) => setDraft((d) => ({ ...d, ...p }));
  const num = (v: string) => (v ? Number(v) : undefined);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft({});
          setOpen(true);
        }}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition",
          extra
            ? "border-ink bg-ink text-white"
            : "border-line bg-surface hover:border-line-strong",
        )}
      >
        <SlidersHorizontal className="size-4" />
        More{extra ? ` (${extra})` : ""}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="More filters"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                set({
                  minSqft: undefined,
                  maxSqft: undefined,
                  minYearBuilt: undefined,
                  maxHoa: undefined,
                  features: [],
                  petsAllowed: undefined,
                })
              }
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Show homes
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Min sqft</Label>
              <Select
                value={view.minSqft ?? ""}
                onChange={(e) => set({ minSqft: num(e.target.value) })}
              >
                <option value="">No min</option>
                {[500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000].map((v) => (
                  <option key={v} value={v}>
                    {v.toLocaleString("en-US")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Max sqft</Label>
              <Select
                value={view.maxSqft ?? ""}
                onChange={(e) => set({ maxSqft: num(e.target.value) })}
              >
                <option value="">No max</option>
                {[750, 1000, 1500, 2000, 2500, 3000, 4000, 5000].map((v) => (
                  <option key={v} value={v}>
                    {v.toLocaleString("en-US")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Built after</Label>
              <Select
                value={view.minYearBuilt ?? ""}
                onChange={(e) => set({ minYearBuilt: num(e.target.value) })}
              >
                <option value="">Any year</option>
                {[1950, 1980, 2000, 2010, 2015, 2020].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            {q.listingType === "sale" ? (
              <div>
                <Label>Max HOA / month</Label>
                <Select
                  value={view.maxHoa ?? ""}
                  onChange={(e) => set({ maxHoa: num(e.target.value) })}
                >
                  <option value="">Any</option>
                  <option value="0">No HOA</option>
                  {[100, 200, 300, 500, 750].map((v) => (
                    <option key={v} value={v}>
                      ${v}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <label className="mt-7 flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="accent-brand-600 size-4"
                  checked={Boolean(view.petsAllowed)}
                  onChange={(e) => set({ petsAllowed: e.target.checked || undefined })}
                />
                Pets allowed
              </label>
            )}
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Must-haves</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_AMENITIES.map((a) => {
                const on = view.features.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() =>
                      set({
                        features: on ? view.features.filter((f) => f !== a) : [...view.features, a],
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      on
                        ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                        : "border-line text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {AMENITIES[a]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function SortSelect({ q, onChange }: { q: SearchQuery; onChange: (p: QueryPatch) => void }) {
  return (
    <Select
      aria-label="Sort"
      value={q.sort}
      onChange={(e) => onChange({ sort: e.target.value as SearchQuery["sort"] })}
      className="h-9 w-auto rounded-full text-sm"
    >
      {SORTS.map((s) => (
        <option key={s} value={s}>
          {SORT_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}
