import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { getCurrentSubscription, getUsageSummary, listMyPayments } from "@/server/billing";
import { cancelMySubscriptionAction, resumeMySubscriptionAction } from "@/server/actions/billing";
import { ActionButton } from "@/components/admin/controls";
import { StatusPill } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { formatCents, formatDate } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage(props: PageProps<"/billing">) {
  const sp = (await props.searchParams) as SP;
  const user = await requireUser("/billing");
  const [current, usage, payments, monetization] = await Promise.all([
    getCurrentSubscription(user.id),
    getUsageSummary(user.id),
    listMyPayments(user.id),
    getSettings("monetization"),
  ]);
  const sub = current?.sub;
  const plan = current?.plan;
  const effectiveEnd =
    sub?.status === "trialing" && sub.trialEndsAt ? sub.trialEndsAt : sub?.currentPeriodEnd;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl">Plan & billing</h1>
      {str(sp, "checkout") === "success" ? (
        <p className="bg-brand-50 text-brand-700 mt-5 rounded-xl p-3 text-sm">
          You&apos;re all set. Your plan is active.
        </p>
      ) : null}
      {!monetization.subscriptionsEnabled ? (
        <p className="bg-brand-50 text-brand-700 mt-5 rounded-xl p-3 text-sm">
          Dwellwise is currently free for everyone. Every feature is unlocked.
        </p>
      ) : null}

      <Card className="mt-6 p-6">
        {plan && sub ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-muted text-sm">Current plan</p>
                <p className="mt-1 text-2xl font-semibold">{plan.name}</p>
                <p className="text-muted mt-1 text-sm">
                  {formatCents(
                    sub.interval === "year" ? plan.priceAnnual : plan.priceMonthly,
                    plan.currency,
                  )}
                  /{sub.interval === "year" ? "year" : "month"}
                </p>
              </div>
              <StatusPill status={sub.status} />
            </div>
            <p className="text-ink-2 mt-4 text-sm">
              {sub.status === "trialing" && effectiveEnd
                ? `Free trial ends ${formatDate(effectiveEnd)}.`
                : sub.cancelAtPeriodEnd && effectiveEnd
                  ? `Cancelled — access continues until ${formatDate(effectiveEnd)}.`
                  : effectiveEnd
                    ? `Renews ${formatDate(effectiveEnd)}.`
                    : null}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ButtonLink href="/pricing" variant="secondary" size="sm">
                Change plan
              </ButtonLink>
              {sub.cancelAtPeriodEnd ? (
                <ActionButton tone="primary" action={resumeMySubscriptionAction}>
                  Resume subscription
                </ActionButton>
              ) : (
                <ActionButton
                  tone="danger"
                  confirm="Cancel your plan? You keep access until the end of the current period."
                  action={cancelMySubscriptionAction}
                >
                  Cancel plan
                </ActionButton>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-muted text-sm">Current plan</p>
              <p className="mt-1 text-2xl font-semibold">Free</p>
            </div>
            <ButtonLink href="/pricing">See plans</ButtonLink>
          </div>
        )}
      </Card>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Usage</h2>
      <Card className="divide-line divide-y">
        {usage.map((u) => {
          const pct = u.limit ? Math.min(100, (u.used / u.limit) * 100) : 0;
          return (
            <div key={u.key} className="p-5">
              <div className="flex justify-between text-sm">
                <span>{u.label}</span>
                <span className="tabular">
                  {!u.allowed ? (
                    <span className="text-muted">Not included</span>
                  ) : u.limit === null ? (
                    <>
                      {u.used} <span className="text-muted">· unlimited</span>
                    </>
                  ) : (
                    `${u.used} / ${u.limit}`
                  )}
                </span>
              </div>
              {u.allowed && u.limit !== null ? (
                <div className="bg-paper-2 mt-2 h-2 overflow-hidden rounded-full">
                  <div
                    className={pct >= 90 ? "bg-clay-500 h-full" : "bg-brand-600 h-full"}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Payment history</h2>
      <Card>
        {payments.length === 0 ? (
          <p className="text-muted flex items-center gap-2 p-5 text-sm">
            <CreditCard className="size-4" /> No payments yet.
          </p>
        ) : (
          <ul className="divide-line divide-y">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="block font-medium">{p.description ?? "Payment"}</span>
                  <span className="text-muted text-xs">
                    {formatDate(p.createdAt)} · {p.provider}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular">{formatCents(p.amount, p.currency)}</span>
                  <StatusPill status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
