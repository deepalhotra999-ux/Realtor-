"use client";

import { useActionState } from "react";
import { saveHomePreferencesAction } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { AMENITIES, PROPERTY_TYPE_LABELS, PROPERTY_TYPES, type AmenityKey } from "@/lib/domain";
import type { Preferences } from "@/lib/ai/match";

const TOP_AMENITIES: AmenityKey[] = [
  "garage",
  "fenced_yard",
  "home_office",
  "in_unit_laundry",
  "central_air",
  "pool",
  "ev_charger",
  "balcony",
  "patio",
  "open_floor_plan",
];

export function HomePrefsForm({ p }: { p: Preferences }) {
  const [state, action, pending] = useActionState(saveHomePreferencesAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Looking to">
          <Select name="listingType" defaultValue={p.listingType ?? ""} className="h-10">
            <option value="">Either</option>
            <option value="sale">Buy</option>
            <option value="rent">Rent</option>
          </Select>
        </Field>
        <Field label="Where">
          <Input
            name="place"
            defaultValue={p.center?.label ?? ""}
            placeholder="City"
            className="h-10"
          />
        </Field>
        <Field label="Min price ($)">
          <Input
            name="minPrice"
            type="number"
            min={0}
            defaultValue={p.minPrice ?? ""}
            className="h-10"
          />
        </Field>
        <Field label="Max price ($)">
          <Input
            name="maxPrice"
            type="number"
            min={0}
            defaultValue={p.maxPrice ?? ""}
            className="h-10"
          />
        </Field>
        <Field label="Bedrooms (min)">
          <Input
            name="minBeds"
            type="number"
            min={0}
            max={20}
            defaultValue={p.minBeds ?? ""}
            className="h-10"
          />
        </Field>
        <Field label="Bathrooms (min)">
          <Input
            name="minBaths"
            type="number"
            min={0}
            max={20}
            defaultValue={p.minBaths ?? ""}
            className="h-10"
          />
        </Field>
      </div>
      <fieldset>
        <legend className="text-ink-2 mb-2 text-sm font-medium">Home types</legend>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.filter((t) => t !== "land").map((t) => (
            <label
              key={t}
              className="border-line flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name="propertyTypes"
                value={t}
                defaultChecked={p.propertyTypes?.includes(t)}
                className="accent-brand-600"
              />
              {PROPERTY_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-ink-2 mb-2 text-sm font-medium">Must-haves</legend>
        <div className="flex flex-wrap gap-2">
          {TOP_AMENITIES.map((k) => (
            <label
              key={k}
              className="border-line flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name="features"
                value={k}
                defaultChecked={p.features?.includes(k)}
                className="accent-brand-600"
              />
              {AMENITIES[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Update matches"}
        </Button>
        {state?.error ? (
          <p className="text-clay-600 text-sm">{state.error}</p>
        ) : state?.message ? (
          <p className="text-brand-700 text-sm">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
