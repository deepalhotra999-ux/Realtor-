import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { getCurrentSubscription, listPublicPlans } from "@/server/billing";
import { startCheckoutAction } from "@/server/actions/billing";
import { Button, ButtonLink } from "@/components/ui/button";
import { annualSavingsPct, priceFor } from "@/lib/billing";
import { formatCents } from "@/lib/format";
import { str, type SP } from "@/lib/params";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plans for agents, brokerages and property managers.",
};

const AUDIENCES = [
  { value: "agent", label: "Agents" },
  { value: "broker", label: "Brokerages & teams" },
  { value: "property_manager", label: "Property managers" },
  { value: "consumer", label: "Home shoppers" },
] as const;

/** Sign-up link preselecting the account type the plan is for. */
function registerHref(audience: string) {
  return audience === "consumer"
    ? "/register?next=/pricing"
    : `/register?role=${audience}&next=/pricing`;
}

export default async function PricingPage(props: PageProps<"/pricing">) {
  const sp = (await props.searchParams) as SP;
  const interval = str(sp, "interval") === "year" ? "year" : "month";
  const [user, monetization, plans] = await Promise.all([
    getCurrentUser(),
    getSettings("monetization"),
    listPublicPlans().catch(() => []),
  ]);
  const current = user ? await getCurrentSubscription(user.id).catch(() => null) : null;
  const groups = AUDIENCES.map((a) => ({
    ...a,
    plans: plans.filter((p) => p.audience === a.value),
  })).filter((g) => g.plans.length);
  const notice =
    str(sp, "checkout") === "canceled"
      ? "Checkout cancelled — you weren't charged."
      : str(sp, "checkout") === "expired"
        ? "That checkout session expired. Please start again."
        : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl sm:text-5xl">Simple, honest pricing</h1>
        <p className="text-muted mt-4 text-lg">
          Searching for a home is always free. Professionals choose the tools they need.
        </p>
      </div>

      {!monetization.subscriptionsEnabled ? (
        <div className="border-brand-200 bg-brand-50 text-brand-700 mx-auto mt-8 flex max-w-2xl items-center gap-3 rounded-2xl border p-4 text-sm">
          <Sparkles className="size-5 shrink-0" />
          <p>
            <strong>Everything is free right now.</strong> Every feature is unlocked for every
            account. The plans below show what will be offered later.
          </p>
        </div>
      ) : null}
      {notice ? (
        <p className="bg-paper-2 mx-auto mt-6 max-w-2xl rounded-xl p-3 text-center text-sm">
          {notice}
        </p>
      ) : null}

      <div className="mt-8 flex justify-center">
        <div className="bg-paper-2 inline-flex rounded-full p-1 text-sm">
          {(["month", "year"] as const).map((iv) => (
            <Link
              key={iv}
              href={iv === "month" ? "/pricing" : "/pricing?interval=year"}
              className={cn(
                "rounded-full px-4 py-1.5",
                interval === iv ? "bg-surface font-medium shadow-sm" : "text-ink-2",
              )}
            >
              {iv === "month" ? "Monthly" : "Annual"}
            </Link>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted mt-12 text-center">No plans are published yet.</p>
      ) : null}
      {groups.map((g) => (
        <section key={g.value} className="mt-12">
          <h2 className="mb-5 text-xl font-semibold">{g.label}</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {g.plans.map((p) => {
              const price = priceFor(p, interval);
              const savings = annualSavingsPct(p);
              const isCurrent = current?.plan.id === p.id && current.sub.status !== "expired";
              return (
                <article
                  key={p.id}
                  className={cn(
                    "bg-surface shadow-card flex flex-col rounded-3xl border p-6",
                    p.highlight ? "border-brand-400 ring-brand-100 ring-4" : "border-line",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    {p.highlight ? (
                      <span className="bg-brand-600 rounded-full px-2 py-0.5 text-xs font-medium text-white">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  {p.description ? (
                    <p className="text-muted mt-1 text-sm">{p.description}</p>
                  ) : null}
                  <p className="mt-5">
                    <span className="text-4xl font-semibold tracking-tight">
                      {price === 0 ? "Free" : formatCents(price, p.currency)}
                    </span>
                    {price > 0 ? (
                      <span className="text-muted">/{interval === "year" ? "yr" : "mo"}</span>
                    ) : null}
                  </p>
                  <p className="text-muted mt-1 h-5 text-xs">
                    {interval === "year" && savings ? `Save ${savings}% vs monthly` : null}
                    {interval === "month" && p.trialDays ? `${p.trialDays}-day free trial` : null}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    {p.grants.map((gr) => (
                      <li key={gr.key} className="flex gap-2">
                        <Check className="text-brand-600 mt-0.5 size-4 shrink-0" /> {gr.label}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {isCurrent ? (
                      <ButtonLink href="/billing" variant="secondary" className="w-full">
                        Current plan
                      </ButtonLink>
                    ) : !monetization.subscriptionsEnabled ? (
                      <ButtonLink
                        href={
                          user
                            ? p.audience === "consumer" || user.role === "consumer"
                              ? "/"
                              : "/pro"
                            : registerHref(p.audience)
                        }
                        variant="secondary"
                        className="w-full"
                      >
                        {user ? "Included free" : "Start free"}
                      </ButtonLink>
                    ) : !user ? (
                      <ButtonLink href={registerHref(p.audience)} className="w-full">
                        Create an account
                      </ButtonLink>
                    ) : (
                      <form action={startCheckoutAction.bind(null, p.id, interval)}>
                        <Button
                          type="submit"
                          className="w-full"
                          variant={p.highlight ? "primary" : "secondary"}
                        >
                          {price === 0
                            ? "Switch to this plan"
                            : current
                              ? "Switch plan"
                              : "Choose plan"}
                        </Button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
