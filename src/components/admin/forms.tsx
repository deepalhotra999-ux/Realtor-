"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import {
  grantPlanAction,
  runAlertsNowAction,
  saveAISettingsAction,
  saveFeatureAction,
  saveFlagAction,
  saveGeneralSettingsAction,
  saveMonetizationSettingsAction,
  savePlanAction,
  sendTestEmailAction,
  testAIAction,
  type AdminFormState,
} from "@/server/actions/admin";
import type { AISettings, GeneralSettings, MonetizationSettings } from "@/lib/settings-schema";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function Status({ state }: { state: AdminFormState }) {
  if (!state) return null;
  return state.error ? (
    <p className="bg-clay-50 text-clay-600 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <TriangleAlert className="size-4" />
      {state.error}
    </p>
  ) : state.message ? (
    <p className="bg-brand-50 text-brand-700 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <CheckCircle2 className="size-4" />
      {state.message}
    </p>
  ) : null;
}

/** Checkbox styled as a switch row. Uses native inputs so forms stay progressive. */
function SwitchRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="text-muted mt-0.5 block text-xs">{description}</span>
        ) : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="bg-line-strong peer-checked:bg-brand-600 peer-focus-visible:ring-brand-100 h-6 w-11 rounded-full transition peer-focus-visible:ring-4" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function GeneralSettingsForm({ s }: { s: GeneralSettings }) {
  const [state, action, pending] = useActionState(saveGeneralSettingsAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site name">
          <Input name="siteName" defaultValue={s.siteName} required />
        </Field>
        <Field label="Support email">
          <Input name="supportEmail" type="email" defaultValue={s.supportEmail} />
        </Field>
      </div>
      <Field label="Tagline">
        <Input name="tagline" defaultValue={s.tagline} />
      </Field>
      <div className="divide-line divide-y">
        <SwitchRow
          name="allowRegistration"
          label="Allow new registrations"
          defaultChecked={s.allowRegistration}
        />
        <SwitchRow
          name="demoDataNotice"
          label="Show demo-data notice"
          description="Banner stating listings are fictional sample data."
          defaultChecked={s.demoDataNotice}
        />
        <SwitchRow
          name="requireListingApproval"
          label="Require listing approval"
          description="New pro listings start as drafts until an admin publishes them."
          defaultChecked={s.requireListingApproval}
        />
        <SwitchRow
          name="requireReviewApproval"
          label="Moderate reviews before publishing"
          defaultChecked={s.requireReviewApproval}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Default map view</p>
        <div className="grid grid-cols-3 gap-3">
          <Input
            name="lat"
            type="number"
            step="0.0001"
            defaultValue={s.defaultMapCenter.lat}
            aria-label="Latitude"
          />
          <Input
            name="lng"
            type="number"
            step="0.0001"
            defaultValue={s.defaultMapCenter.lng}
            aria-label="Longitude"
          />
          <Input
            name="zoom"
            type="number"
            min={2}
            max={18}
            defaultValue={s.defaultMapCenter.zoom}
            aria-label="Zoom"
          />
        </div>
      </div>
      <Status state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save general settings"}
      </Button>
    </form>
  );
}

export function MonetizationForm({
  s,
  features,
}: {
  s: MonetizationSettings;
  features: { key: string; name: string; category: string }[];
}) {
  const [state, action, pending] = useActionState(saveMonetizationSettingsAction, undefined);
  const [on, setOn] = useState(s.subscriptionsEnabled);
  return (
    <form action={action} className="space-y-6">
      <div
        className={cn(
          "rounded-2xl border p-5 transition",
          on ? "border-sky-600/30 bg-sky-100/40" : "border-brand-200 bg-brand-50/60",
        )}
      >
        <label className="flex cursor-pointer items-center justify-between gap-6">
          <span>
            <span className="block font-semibold">Subscription system</span>
            <span className="text-muted mt-1 block text-sm">
              {on
                ? "Plans are enforced for the paid features you select below."
                : "OFF — the entire platform is free. Plans are kept but not enforced."}
            </span>
          </span>
          <span className="relative inline-flex shrink-0">
            <input
              type="checkbox"
              name="subscriptionsEnabled"
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
              className="peer sr-only"
            />
            <span className="bg-line-strong peer-checked:bg-brand-600 h-7 w-12 rounded-full transition" />
            <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Trial duration (days)" hint="Used when a plan has no trial length.">
          <Input
            name="trialDurationDays"
            type="number"
            min={0}
            max={365}
            defaultValue={s.trialDurationDays}
          />
        </Field>
        <Field label="Free listings" hint="Blank = unlimited.">
          <Input
            name="freeListingsLimit"
            type="number"
            min={0}
            defaultValue={s.freeListingsLimit ?? ""}
            placeholder="Unlimited"
          />
        </Field>
        <Field label="Currency">
          <Input name="currency" maxLength={3} defaultValue={s.currency} />
        </Field>
      </div>

      <div className="divide-line border-line divide-y rounded-2xl border px-4">
        <SwitchRow
          name="freeTrialEnabled"
          label="Free trials"
          description="New subscriptions start with a trial."
          defaultChecked={s.freeTrialEnabled}
        />
        <SwitchRow
          name="freeAgentAccounts"
          label="Free agent accounts"
          description="Agents, brokers and property managers can work without a plan."
          defaultChecked={s.freeAgentAccounts}
        />
        <SwitchRow
          name="aiFeaturesEnabled"
          label="AI features"
          description="Global switch for every AI capability."
          defaultChecked={s.aiFeaturesEnabled}
        />
        <SwitchRow
          name="featuredListingsEnabled"
          label="Featured listings"
          defaultChecked={s.featuredListingsEnabled}
        />
        <SwitchRow
          name="advertisingEnabled"
          label="Advertising"
          defaultChecked={s.advertisingEnabled}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Paid features</legend>
        <p className="text-muted mt-1 text-xs">
          When the subscription system is ON, these require an entitlement from the user&apos;s
          plan. Everything else stays free.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {features.map((f) => (
            <label
              key={f.key}
              className="border-line hover:bg-paper flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm"
            >
              <input
                type="checkbox"
                name="paidFeatures"
                value={f.key}
                defaultChecked={s.paidFeatures.includes(f.key)}
                className="accent-brand-600 size-4"
              />
              <span className="flex-1">{f.name}</span>
              <code className="text-muted text-[11px]">{f.key}</code>
            </label>
          ))}
        </div>
      </fieldset>
      <Status state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save monetization settings"}
      </Button>
    </form>
  );
}

export function AISettingsForm({ s }: { s: AISettings }) {
  const [state, action, pending] = useActionState(saveAISettingsAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <div className="divide-line divide-y">
        <SwitchRow
          name="naturalLanguageSearch"
          label="Natural-language search"
          defaultChecked={s.naturalLanguageSearch}
        />
        <SwitchRow name="homeFinder" label="AI Home Finder" defaultChecked={s.homeFinder} />
        <SwitchRow name="propertyQA" label="Property Q&A" defaultChecked={s.propertyQA} />
        <SwitchRow
          name="listingDescriptions"
          label="Listing description writer"
          defaultChecked={s.listingDescriptions}
        />
        <SwitchRow
          name="agentAssistant"
          label="Agent assistant"
          defaultChecked={s.agentAssistant}
        />
        <SwitchRow
          name="comparisonSummaries"
          label="Comparison summaries"
          defaultChecked={s.comparisonSummaries}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Free monthly requests per user"
          hint="Applies in free mode. Blank = unlimited."
        >
          <Input
            name="freeMonthlyRequests"
            type="number"
            min={0}
            defaultValue={s.freeMonthlyRequests ?? ""}
            placeholder="Unlimited"
          />
        </Field>
        <Field
          label="Temperature"
          hint="Lower = more literal. 0.2 recommended for grounded answers."
        >
          <Input
            name="temperature"
            type="number"
            step="0.05"
            min={0}
            max={2}
            defaultValue={s.temperature}
          />
        </Field>
      </div>
      <Status state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save AI settings"}
      </Button>
    </form>
  );
}

export function AIPlayground() {
  const [state, action, pending] = useActionState(testAIAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Textarea
        name="prompt"
        rows={3}
        defaultValue="In one sentence, what makes a good first home?"
        aria-label="Prompt"
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Running…" : "Run prompt"}
      </Button>
      {state?.output ? (
        <div className="bg-paper rounded-xl p-4 text-sm">
          <p className="whitespace-pre-wrap">{state.output}</p>
          <p className="text-muted mt-2 text-xs">{state.message}</p>
        </div>
      ) : (
        <Status state={state} />
      )}
    </form>
  );
}

export function TestEmailForm({ defaultTo }: { defaultTo: string }) {
  const [state, action, pending] = useActionState(sendTestEmailAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <Input
        name="to"
        type="email"
        defaultValue={defaultTo}
        className="h-10 max-w-xs"
        aria-label="Recipient"
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send test email"}
      </Button>
      <div className="w-full">
        <Status state={state} />
      </div>
    </form>
  );
}

export function RunAlertsForm() {
  const [state, action, pending] = useActionState(runAlertsNowAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Running…" : "Run saved-search alerts now"}
      </Button>
      <Status state={state} />
    </form>
  );
}

const ROLES = ["consumer", "agent", "broker", "property_manager", "admin"] as const;

export function FlagForm({
  flag,
}: {
  flag?: {
    key: string;
    description: string;
    enabled: boolean;
    rolloutPercent: number;
    roles: string[];
  };
}) {
  const [state, action, pending] = useActionState(saveFlagAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Key">
          <Input
            name="key"
            defaultValue={flag?.key}
            readOnly={Boolean(flag)}
            required
            placeholder="new_checkout"
          />
        </Field>
        <Field label="Rollout %">
          <Input
            name="rolloutPercent"
            type="number"
            min={0}
            max={100}
            defaultValue={flag?.rolloutPercent ?? 100}
          />
        </Field>
      </div>
      <Field label="Description">
        <Input name="description" defaultValue={flag?.description} />
      </Field>
      <div>
        <p className="mb-2 text-sm font-medium">
          Limit to roles <span className="text-muted font-normal">(none = everyone)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <label
              key={r}
              className="border-line flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name="roles"
                value={r}
                defaultChecked={flag?.roles.includes(r)}
                className="accent-brand-600"
              />{" "}
              {r.replace("_", " ")}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={flag?.enabled ?? false}
          className="accent-brand-600"
        />{" "}
        Enabled
      </label>
      <Status state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : flag ? "Save flag" : "Create flag"}
      </Button>
    </form>
  );
}

export interface PlanFormValue {
  id?: string;
  key: string;
  name: string;
  description: string;
  audience: string;
  priceMonthly: number;
  priceAnnual: number;
  trialDays: number;
  sortOrder: number;
  isActive: boolean;
  isPublic: boolean;
  isDefault: boolean;
  highlight: boolean;
  entitlements: Record<string, { enabled: boolean; limit: number | null }>;
}

export function PlanForm({
  plan,
  features,
  onDone,
}: {
  plan?: PlanFormValue;
  features: { key: string; name: string; kind: string; unit: string | null; category: string }[];
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: AdminFormState, form: FormData) => {
    const res = await savePlanAction(prev, form);
    if (res?.ok) onDone?.();
    return res;
  }, undefined);
  const p = plan;
  return (
    <form action={action} className="space-y-5">
      {p?.id ? <input type="hidden" name="id" value={p.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <Input name="name" defaultValue={p?.name} required />
        </Field>
        <Field label="Key">
          <Input name="key" defaultValue={p?.key} required placeholder="agent_pro" />
        </Field>
        <Field label="Audience">
          <Select name="audience" defaultValue={p?.audience ?? "agent"}>
            <option value="agent">Agents</option>
            <option value="broker">Brokers & teams</option>
            <option value="property_manager">Property managers</option>
            <option value="consumer">Consumers</option>
          </Select>
        </Field>
      </div>
      <Field label="Description">
        <Input name="description" defaultValue={p?.description} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Monthly price ($)">
          <Input
            name="priceMonthly"
            type="number"
            min={0}
            step="0.01"
            defaultValue={p ? p.priceMonthly / 100 : 0}
          />
        </Field>
        <Field label="Annual price ($)">
          <Input
            name="priceAnnual"
            type="number"
            min={0}
            step="0.01"
            defaultValue={p ? p.priceAnnual / 100 : 0}
          />
        </Field>
        <Field label="Trial days" hint="0 = platform default">
          <Input
            name="trialDays"
            type="number"
            min={0}
            max={365}
            defaultValue={p?.trialDays ?? 0}
          />
        </Field>
        <Field label="Sort order">
          <Input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(
          [
            ["isActive", "Active", p?.isActive ?? true],
            ["isPublic", "Shown on pricing page", p?.isPublic ?? true],
            ["isDefault", "Default (free) plan", p?.isDefault ?? false],
            ["highlight", "Highlight as recommended", p?.highlight ?? false],
          ] as const
        ).map(([n, l, v]) => (
          <label key={n} className="flex items-center gap-2">
            <input type="checkbox" name={n} defaultChecked={v} className="accent-brand-600" /> {l}
          </label>
        ))}
      </div>
      <div>
        <p className="text-sm font-semibold">Entitlements</p>
        <p className="text-muted text-xs">
          Enable features for this plan. For limits and meters, leave blank for unlimited.
        </p>
        <div className="border-line mt-3 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <tbody>
              {features.map((f) => {
                const e = p?.entitlements[f.key];
                return (
                  <tr key={f.key} className="border-line border-b last:border-0">
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          name={`ent.${f.key}.enabled`}
                          defaultChecked={e?.enabled ?? false}
                          className="accent-brand-600 size-4"
                        />
                        <span>
                          <span className="block font-medium">{f.name}</span>
                          <code className="text-muted text-[11px]">{f.key}</code>
                        </span>
                      </label>
                    </td>
                    <td className="text-muted px-3 py-2 text-xs">{f.kind}</td>
                    <td className="w-40 px-3 py-2">
                      {f.kind !== "boolean" ? (
                        <Input
                          name={`ent.${f.key}.limit`}
                          type="number"
                          min={0}
                          defaultValue={e?.limit ?? ""}
                          placeholder="Unlimited"
                          className="h-9"
                          aria-label={`${f.name} limit`}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Status state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : p?.id ? "Save plan" : "Create plan"}
      </Button>
    </form>
  );
}

export function FeatureForm() {
  const [state, action, pending] = useActionState(saveFeatureAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Key">
          <Input name="key" required placeholder="listings.virtual_tours" />
        </Field>
        <Field label="Name">
          <Input name="name" required placeholder="3D virtual tours" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Kind">
          <Select name="kind" defaultValue="boolean">
            <option value="boolean">On / off</option>
            <option value="limit">Limit (e.g. listings)</option>
            <option value="metered">Metered per month</option>
          </Select>
        </Field>
        <Field label="Unit">
          <Input name="unit" placeholder="tours" />
        </Field>
        <Field label="Category">
          <Input name="category" defaultValue="general" />
        </Field>
      </div>
      <Field label="Description">
        <Input name="description" />
      </Field>
      <Status state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Add feature"}
      </Button>
    </form>
  );
}

export function GrantPlanForm({ plans }: { plans: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(grantPlanAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_120px]">
        <Field label="User email">
          <Input name="email" type="email" required placeholder="agent@dwellwise.local" />
        </Field>
        <Field label="Plan">
          <Select name="planId">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Days">
          <Input name="days" type="number" min={1} defaultValue={30} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="asTrial" defaultChecked className="accent-brand-600" /> Grant
        as a trial
      </label>
      <Status state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Granting…" : "Grant plan"}
      </Button>
    </form>
  );
}
