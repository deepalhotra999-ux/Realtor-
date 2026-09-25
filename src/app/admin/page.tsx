import Link from "next/link";
import { ArrowRight, CircleCheck, CircleAlert } from "lucide-react";
import { getOverview } from "@/server/admin/queries";
import { getSettings } from "@/server/settings";
import { describeProviders } from "@/providers";
import { KPI, PageHeader, Panel, Pill } from "@/components/admin/ui";
import { LineChart } from "@/components/charts";
import { formatCents, formatNumber, relativeTime } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const [o, providers, monetization, ai] = await Promise.all([
    getOverview(),
    describeProviders(),
    getSettings("monetization"),
    getSettings("ai"),
  ]);
  const dayLabel = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <>
      <PageHeader
        title="Overview"
        description="Last 30 days compared with the 30 days before."
        actions={
          <Pill tone={monetization.subscriptionsEnabled ? "blue" : "green"}>
            {monetization.subscriptionsEnabled
              ? "Subscriptions ON"
              : "Free mode — subscriptions OFF"}
          </Pill>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KPI
          label="New users"
          value={formatNumber(o.users.cur)}
          delta={{ value: o.users.delta }}
          hint={`${formatNumber(o.users.total)} total`}
        />
        <KPI
          label="New listings"
          value={formatNumber(o.listings.cur)}
          delta={{ value: o.listings.delta }}
          hint={`${formatNumber(o.activeListings)} active`}
        />
        <KPI label="Leads" value={formatNumber(o.leads.cur)} delta={{ value: o.leads.delta }} />
        <KPI
          label="Tour requests"
          value={formatNumber(o.tours.cur)}
          delta={{ value: o.tours.delta }}
        />
        <KPI label="AI requests" value={formatNumber(o.ai.cur)} delta={{ value: o.ai.delta }} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="self-start">
          <LineChart
            title="Listing views"
            subtitle="Daily, last 30 days"
            valueLabel="Views"
            data={o.views.map((v) => ({
              label: dayLabel(v.day),
              value: v.n,
              detail: dayLabel(v.day),
            }))}
          />
        </div>
        <div className="space-y-6">
          <Panel title="Needs attention">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span>Reviews awaiting moderation</span>
                <Link
                  href="/admin/reviews"
                  className="text-brand-600 flex items-center gap-1 font-medium"
                >
                  {o.pendingReviews} <ArrowRight className="size-3.5" />
                </Link>
              </li>
              <li className="flex items-center justify-between">
                <span>Open trust & safety reports</span>
                <Link
                  href="/admin/reports"
                  className="text-brand-600 flex items-center gap-1 font-medium"
                >
                  {o.openReports} <ArrowRight className="size-3.5" />
                </Link>
              </li>
              <li className="flex items-center justify-between">
                <span>Active trials</span>
                <Link
                  href="/admin/subscriptions?status=trialing"
                  className="text-brand-600 flex items-center gap-1 font-medium"
                >
                  {o.subsByStatus.trialing ?? 0} <ArrowRight className="size-3.5" />
                </Link>
              </li>
              <li className="flex items-center justify-between">
                <span>Revenue (30 days, {providers.payment} provider)</span>
                <span className="font-medium">{formatCents(o.revenue30dCents)}</span>
              </li>
            </ul>
          </Panel>
          <Panel
            title="Providers"
            description="All free / self-hosted. Swap via environment variables."
          >
            <ul className="space-y-2 text-sm">
              {[
                [
                  "AI",
                  `${providers.ai.name} (${providers.ai.model})`,
                  providers.ai.kind === "llm" || !ai.naturalLanguageSearch,
                ],
                ["Search", providers.search, true],
                ["Maps", providers.map, true],
                ["Geocoding", providers.geocoding, true],
                ["Storage", providers.storage, true],
                ["Email", providers.email, true],
                ["SMS", providers.sms, true],
                ["Property data", providers.propertyData, true],
                ["Payments", providers.payment, true],
              ].map(([k, v, ok]) => (
                <li key={k as string} className="flex items-center justify-between gap-3">
                  <span className="text-muted">{k}</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {ok ? (
                      <CircleCheck className="text-brand-600 size-3.5" />
                    ) : (
                      <CircleAlert className="text-gold-500 size-3.5" />
                    )}
                    {v}
                  </span>
                </li>
              ))}
            </ul>
            {providers.ai.kind !== "llm" ? (
              <p className="bg-gold-100/60 text-gold-700 mt-3 rounded-lg p-2.5 text-xs">
                Ollama isn&apos;t reachable, so AI features use deterministic rules. Run{" "}
                <code>ollama pull llama3.2</code> to enable local models.
              </p>
            ) : null}
          </Panel>
        </div>
      </div>

      <Panel
        title="Recent admin activity"
        className="mt-6"
        actions={
          <Link href="/admin/audit" className="text-brand-600 text-sm">
            View all
          </Link>
        }
        padded={false}
      >
        <ul className="divide-line divide-y">
          {o.recentAudit.map(({ a, actor }) => (
            <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span>
                <span className="font-medium">{actor ?? "System"}</span>{" "}
                <span className="text-muted">·</span> <code className="text-xs">{a.action}</code>
                {a.targetType ? <span className="text-muted"> on {a.targetType}</span> : null}
              </span>
              <span className="text-muted shrink-0 text-xs">{relativeTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
