import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarCheck, Megaphone, Sparkles } from "lucide-react";
import { estimateValue } from "@/server/market";
import { METROS } from "@/lib/geo/places";
import { PROPERTY_TYPE_LABELS } from "@/lib/domain";
import { formatCompactPrice, formatNumber, formatPrice } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

export const metadata: Metadata = { title: "Sell your home" };

const TYPES = ["single_family", "condo", "townhouse", "multi_family"] as const;

export default async function SellPage(props: PageProps<"/sell">) {
  const sp = await props.searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const metro = METROS.find((m) => `${m.city}, ${m.state}` === s("city"));
  const sqft = Number(s("sqft"));
  const beds = Number(s("beds"));
  const type = (TYPES as readonly string[]).includes(s("type")) ? s("type") : "single_family";
  const submitted = Boolean(metro && sqft > 200 && beds >= 0 && s("beds") !== "");
  const estimate = submitted
    ? await estimateValue({
        city: metro!.city,
        state: metro!.state,
        neighborhood: s("hood") || undefined,
        sqft,
        beds,
        propertyType: type,
      })
    : null;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_440px]">
        <div>
          <p className="text-brand-600 text-xs font-semibold tracking-[0.14em] uppercase">
            Sell with confidence
          </p>
          <h1 className="font-display mt-2 text-5xl leading-tight">What&apos;s your home worth?</h1>
          <p className="text-ink-2 mt-4 max-w-xl text-lg">
            A free, transparent estimate built from comparable homes — with every comp shown. Then
            list with a local agent or on your own.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[
              {
                icon: BarChart3,
                t: "Transparent pricing",
                d: "See the comparable homes behind every estimate — no black box.",
              },
              {
                icon: Sparkles,
                t: "AI listing writer",
                d: "Turn your home's facts into a polished description in seconds.",
              },
              {
                icon: CalendarCheck,
                t: "Tours on autopilot",
                d: "Buyers book in-person or video tours straight into your calendar.",
              },
              {
                icon: Megaphone,
                t: "Reach motivated buyers",
                d: "Matched to buyers whose saved searches fit your home.",
              },
            ].map((f) => (
              <div key={f.t} className="border-line bg-surface rounded-2xl border p-5">
                <f.icon className="text-brand-600 size-5" />
                <p className="mt-3 font-semibold">{f.t}</p>
                <p className="text-muted mt-1 text-sm">{f.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-line bg-surface shadow-lift rounded-3xl border p-6">
          <h2 className="font-display text-2xl">Instant estimate</h2>
          <form className="mt-5 space-y-4">
            <Field label="Market">
              <Select name="city" defaultValue={s("city") || "Austin, TX"} required>
                {METROS.map((m) => (
                  <option key={m.city}>
                    {m.city}, {m.state}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Neighborhood (optional)">
              <Select name="hood" defaultValue={s("hood")}>
                <option value="">Any</option>
                {METROS.flatMap((m) =>
                  m.neighborhoods.map((n) => (
                    <option key={`${m.city}-${n.name}`} value={n.name}>
                      {n.name} ({m.city})
                    </option>
                  )),
                )}
              </Select>
            </Field>
            <Field label="Home type">
              <Select name="type" defaultValue={type}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROPERTY_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bedrooms">
                <Input
                  name="beds"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={s("beds") || "3"}
                  required
                />
              </Field>
              <Field label="Square feet">
                <Input
                  name="sqft"
                  type="number"
                  min={300}
                  max={20000}
                  defaultValue={s("sqft") || "1800"}
                  required
                />
              </Field>
            </div>
            <Button type="submit" size="lg" className="w-full">
              Get my estimate
            </Button>
          </form>

          {submitted ? (
            estimate ? (
              <div className="bg-brand-50 mt-6 rounded-2xl p-5">
                <p className="text-brand-700 text-sm">Estimated value</p>
                <p className="text-brand-800 mt-1 text-4xl font-semibold">
                  {formatPrice(estimate.mid)}
                </p>
                <p className="text-ink-2 mt-1 text-sm">
                  Likely range {formatCompactPrice(estimate.low)} –{" "}
                  {formatCompactPrice(estimate.high)} · ${estimate.ppsf}/sqft
                </p>
                <p className="text-muted mt-3 text-xs">
                  Based on {estimate.compCount} comparable{" "}
                  {PROPERTY_TYPE_LABELS[type as (typeof TYPES)[number]].toLowerCase()} listings. Not
                  an appraisal.
                </p>
              </div>
            ) : (
              <p className="bg-paper text-muted mt-6 rounded-2xl p-4 text-sm">
                Not enough comparable homes to estimate responsibly. Try a different size or home
                type — or ask a local agent.
              </p>
            )
          ) : null}
        </div>
      </div>

      {estimate ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl">Comparable homes used</h2>
          <div className="border-line bg-surface mt-4 overflow-x-auto rounded-3xl border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-paper text-muted text-left text-xs">
                <tr>
                  <th className="px-5 py-3 font-medium">Home</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Beds</th>
                  <th className="px-5 py-3 text-right font-medium">Sqft</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 text-right font-medium">$/sqft</th>
                </tr>
              </thead>
              <tbody>
                {estimate.comps.map((c) => (
                  <tr key={c.id} className="border-line border-t">
                    <td className="px-5 py-3">
                      <Link href={`/homes/${c.slug}`} className="font-medium hover:underline">
                        {c.street}
                      </Link>
                      <span className="text-muted block text-xs">{c.neighborhood}</span>
                    </td>
                    <td className="px-5 py-3 capitalize">{c.status}</td>
                    <td className="tabular px-5 py-3 text-right">{c.beds}</td>
                    <td className="tabular px-5 py-3 text-right">{formatNumber(c.sqft)}</td>
                    <td className="tabular px-5 py-3 text-right">{formatCompactPrice(c.price)}</td>
                    <td className="tabular px-5 py-3 text-right">
                      ${Math.round(c.price / c.sqft)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="bg-ink mt-16 grid grid-cols-1 items-center gap-6 rounded-3xl p-8 text-white sm:grid-cols-[1fr_auto] sm:p-12">
        <div>
          <h2 className="font-display text-3xl">Ready to list?</h2>
          <p className="mt-2 text-white/70">
            Create a free account to publish your listing, or connect with a top-rated local agent.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/register?role=agent" className="text-ink hover:bg-brand-50 bg-white">
            List my home
          </ButtonLink>
          <ButtonLink
            href="/agents"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            Find an agent
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
