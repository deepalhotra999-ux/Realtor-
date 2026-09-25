"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { CheckCircle2, Sparkles, TriangleAlert } from "lucide-react";
import {
  generateListingDescriptionAction,
  saveListingAction,
  type ProFormState,
} from "@/server/actions/pro";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { submitKeepingValues } from "@/components/ui/form-submit";
import { AMENITIES, PROPERTY_TYPE_LABELS, PROPERTY_TYPES, type AmenityKey } from "@/lib/domain";

export interface ListingFormValues {
  id?: string;
  status?: string;
  listingType: "sale" | "rent";
  propertyType: string;
  title: string;
  description: string;
  price: number | null;
  street: string;
  unit: string | null;
  city: string;
  state: string;
  postalCode: string;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  garageSpaces: number | null;
  hoaMonthly: number | null;
  taxAnnual: number | null;
  features: string[];
  availableFrom: string | null;
  leaseTermMonths: number | null;
  deposit: number | null;
  petsAllowed: boolean | null;
  furnished: boolean | null;
}

export function StatusMessage({ state }: { state: ProFormState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p className="bg-clay-50 text-clay-600 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <TriangleAlert className="size-4 shrink-0" /> {state.error}
      </p>
    );
  if (state.message)
    return (
      <p className="bg-brand-50 text-brand-700 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <CheckCircle2 className="size-4 shrink-0" /> {state.message}
      </p>
    );
  return null;
}

const v = (n: number | null | undefined) => (n === null || n === undefined ? "" : n);
const tri = (b: boolean | null) => (b === true ? "yes" : b === false ? "no" : "");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-line bg-surface shadow-card rounded-2xl border p-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

export function ListingForm({ initial }: { initial: ListingFormValues }) {
  const [state, action, pending] = useActionState(saveListingAction, undefined);
  const [type, setType] = useState(initial.listingType);
  const [description, setDescription] = useState(initial.description);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [writing, startWriting] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const live = ["active", "coming_soon", "pending"].includes(initial.status ?? "");

  const write = () =>
    startWriting(async () => {
      if (!formRef.current) return;
      const res = await generateListingDescriptionAction(new FormData(formRef.current));
      if (res?.ok) {
        setDescription(res.text);
        setDraftNote(
          res.provider === "rules"
            ? "Drafted from your facts. Edit freely before saving."
            : `Written by ${res.provider} from your facts only. Review before saving.`,
        );
      } else setDraftNote(res?.error ?? "Couldn't write a description.");
    });

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={submitKeepingValues(action)}
      className="space-y-5"
    >
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Section title="Basics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Listing type">
            <Select
              name="listingType"
              value={type}
              onChange={(e) => setType(e.target.value as "sale" | "rent")}
            >
              <option value="sale">For sale</option>
              <option value="rent">For rent</option>
            </Select>
          </Field>
          <Field label="Property type">
            <Select name="propertyType" defaultValue={initial.propertyType}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={type === "rent" ? "Monthly rent ($)" : "Price ($)"}>
            <Input name="price" type="number" min={1} required defaultValue={v(initial.price)} />
          </Field>
        </div>
        <Field label="Title" hint="Shown on cards and search results.">
          <Input
            name="title"
            required
            maxLength={120}
            defaultValue={initial.title}
            placeholder="Light-filled bungalow with a big backyard"
          />
        </Field>
      </Section>

      <Section title="Location">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Street address">
            <Input name="street" required defaultValue={initial.street} />
          </Field>
          <Field label="Unit">
            <Input name="unit" defaultValue={initial.unit ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="City" className="sm:col-span-2">
            <Input name="city" required defaultValue={initial.city} />
          </Field>
          <Field label="State">
            <Input
              name="state"
              required
              maxLength={2}
              defaultValue={initial.state}
              placeholder="CA"
            />
          </Field>
          <Field label="ZIP">
            <Input name="postalCode" required defaultValue={initial.postalCode} />
          </Field>
        </div>
        <Field label="Neighborhood">
          <Input name="neighborhood" defaultValue={initial.neighborhood ?? ""} />
        </Field>
        <details>
          <summary className="text-muted cursor-pointer text-sm select-none">
            Map coordinates (optional — we geocode the address otherwise)
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Latitude">
              <Input name="latitude" type="number" step="any" defaultValue={v(initial.latitude)} />
            </Field>
            <Field label="Longitude">
              <Input
                name="longitude"
                type="number"
                step="any"
                defaultValue={v(initial.longitude)}
              />
            </Field>
          </div>
        </details>
      </Section>

      <Section title="Facts">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Beds">
            <Input name="beds" type="number" min={0} defaultValue={v(initial.beds)} />
          </Field>
          <Field label="Baths">
            <Input name="baths" type="number" min={0} step="0.5" defaultValue={v(initial.baths)} />
          </Field>
          <Field label="Sqft">
            <Input name="sqft" type="number" min={0} defaultValue={v(initial.sqft)} />
          </Field>
          <Field label="Lot sqft">
            <Input name="lotSqft" type="number" min={0} defaultValue={v(initial.lotSqft)} />
          </Field>
          <Field label="Year built">
            <Input
              name="yearBuilt"
              type="number"
              min={1700}
              max={2100}
              defaultValue={v(initial.yearBuilt)}
            />
          </Field>
          <Field label="Garage spaces">
            <Input
              name="garageSpaces"
              type="number"
              min={0}
              defaultValue={v(initial.garageSpaces)}
            />
          </Field>
          <Field label="HOA / month ($)">
            <Input name="hoaMonthly" type="number" min={0} defaultValue={v(initial.hoaMonthly)} />
          </Field>
          <Field label="Tax / year ($)">
            <Input name="taxAnnual" type="number" min={0} defaultValue={v(initial.taxAnnual)} />
          </Field>
        </div>
        <div>
          <p className="text-ink-2 mb-2 text-sm font-medium">Features</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {(Object.keys(AMENITIES) as AmenityKey[]).map((k) => (
              <label key={k} className="text-ink-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="features"
                  value={k}
                  defaultChecked={initial.features.includes(k)}
                  className="accent-brand-600 size-4"
                />
                {AMENITIES[k]}
              </label>
            ))}
          </div>
        </div>
      </Section>

      {type === "rent" ? (
        <Section title="Rental terms">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Available from">
              <Input name="availableFrom" type="date" defaultValue={initial.availableFrom ?? ""} />
            </Field>
            <Field label="Lease (months)">
              <Input
                name="leaseTermMonths"
                type="number"
                min={1}
                defaultValue={v(initial.leaseTermMonths)}
              />
            </Field>
            <Field label="Deposit ($)">
              <Input name="deposit" type="number" min={0} defaultValue={v(initial.deposit)} />
            </Field>
            <Field label="Pets">
              <Select name="petsAllowed" defaultValue={tri(initial.petsAllowed)}>
                <option value="">Not specified</option>
                <option value="yes">Allowed</option>
                <option value="no">Not allowed</option>
              </Select>
            </Field>
            <Field label="Furnished">
              <Select name="furnished" defaultValue={tri(initial.furnished)}>
                <option value="">Not specified</option>
                <option value="yes">Furnished</option>
                <option value="no">Unfurnished</option>
              </Select>
            </Field>
          </div>
        </Section>
      ) : null}

      <Section title="Description">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted text-sm">
            Describe the home. The AI writer only uses the facts you entered above.
          </p>
          <Button type="button" variant="soft" size="sm" onClick={write} disabled={writing}>
            <Sparkles className="size-4" /> {writing ? "Writing…" : "Write with AI"}
          </Button>
        </div>
        <Textarea
          name="description"
          rows={8}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Description"
        />
        {draftNote ? <p className="text-muted text-xs">{draftNote}</p> : null}
      </Section>

      <div className="border-line bg-paper/90 sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t px-1 py-4 backdrop-blur">
        <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Save draft"}
        </Button>
        {!live ? (
          <Button type="submit" name="intent" value="publish" disabled={pending}>
            Publish
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <StatusMessage state={state} />
        </div>
      </div>
    </form>
  );
}
