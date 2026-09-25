import Link from "next/link";
import { ArrowRight, CalendarClock, Plus } from "lucide-react";
import { requirePro } from "@/server/auth/session";
import { getProOverview } from "@/server/pro/queries";
import { KPI, PageHeader, Panel, Pill, StatusPill } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatNumber, relativeTime } from "@/lib/format";
import { LEAD_STAGE_LABELS, PIPELINE_STAGES } from "@/lib/crm";

export const metadata = { title: "Overview" };

export default async function ProOverviewPage() {
  const user = await requirePro();
  const o = await getProOverview(user.id);
  const pipelineMax = Math.max(1, ...PIPELINE_STAGES.map((s) => o.stages[s] ?? 0));

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Your listings, leads and tours at a glance."
        actions={
          <ButtonLink href="/pro/listings/new" size="sm">
            <Plus className="size-4" /> New listing
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KPI
          label="Live listings"
          value={formatNumber(o.listings.active)}
          hint={`${o.listings.drafts} draft${o.listings.drafts === 1 ? "" : "s"} · ${o.listings.pending} pending`}
        />
        <KPI label="Listing views (30 days)" value={formatNumber(o.views30)} />
        <KPI
          label="New leads (30 days)"
          value={formatNumber(o.leads.new30)}
          hint={`${o.leads.open} open`}
        />
        <KPI label="Deals won" value={formatNumber(o.leads.won)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Follow-ups due"
          description="Open leads due for contact within a day."
          actions={
            <Link href="/pro/leads" className="text-brand-600 text-sm">
              All leads
            </Link>
          }
          padded={false}
        >
          {o.followUps.length === 0 ? (
            <p className="text-muted p-5 text-sm">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-line divide-y">
              {o.followUps.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/pro/leads/${l.id}`}
                    className="hover:bg-paper flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{l.name}</span>
                      <span className="text-muted block truncate text-xs">
                        {l.listing ?? "General inquiry"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Pill>{LEAD_STAGE_LABELS[l.stage]}</Pill>
                      {l.nextFollowUpAt ? (
                        <span
                          className={
                            l.nextFollowUpAt < new Date()
                              ? "text-clay-600 text-xs"
                              : "text-muted text-xs"
                          }
                        >
                          {relativeTime(l.nextFollowUpAt)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Upcoming tours"
          actions={
            <Link href="/pro/tours" className="text-brand-600 text-sm">
              All tours
            </Link>
          }
          padded={false}
        >
          {o.upcoming.length === 0 ? (
            <p className="text-muted p-5 text-sm">No tours scheduled.</p>
          ) : (
            <ul className="divide-line divide-y">
              {o.upcoming.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CalendarClock className="text-brand-600 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.listing}</span>
                      <span className="text-muted text-xs">
                        {t.contactName} ·{" "}
                        {formatDate(t.scheduledAt, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </span>
                  <StatusPill status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Pipeline" className="mt-6">
        <ul className="space-y-2.5">
          {PIPELINE_STAGES.map((s) => {
            const n = o.stages[s] ?? 0;
            return (
              <li key={s}>
                <Link
                  href={`/pro/leads?view=list&stage=${s}`}
                  className="group grid grid-cols-[120px_1fr_40px] items-center gap-3 text-sm"
                >
                  <span className="text-ink-2 group-hover:text-ink">{LEAD_STAGE_LABELS[s]}</span>
                  <span className="bg-paper-2 h-2 overflow-hidden rounded-full">
                    <span
                      className="bg-brand-600 block h-full rounded-full"
                      style={{ width: `${(n / pipelineMax) * 100}%` }}
                    />
                  </span>
                  <span className="tabular text-right font-medium">{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/pro/leads"
          className="text-brand-600 mt-4 inline-flex items-center gap-1 text-sm font-medium"
        >
          Open the pipeline <ArrowRight className="size-4" />
        </Link>
      </Panel>
    </>
  );
}
