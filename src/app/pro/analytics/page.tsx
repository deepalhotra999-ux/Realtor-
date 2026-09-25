import Link from "next/link";
import { requirePro } from "@/server/auth/session";
import { can } from "@/server/entitlements";
import { getProAnalytics } from "@/server/pro/queries";
import {
  FilterTabs,
  KPI,
  PageHeader,
  Panel,
  StatusPill,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { ColumnChart, LineChart } from "@/components/charts";
import { UpgradeNotice } from "@/components/pro/upgrade-notice";
import { FEATURES } from "@/lib/entitlements/catalog";
import { LEAD_SOURCE_LABELS } from "@/lib/crm";
import { formatNumber } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;

export default async function ProAnalyticsPage(props: PageProps<"/pro/analytics">) {
  const sp = (await props.searchParams) as SP;
  const user = await requirePro();
  const allowed = await can(user.id, FEATURES.ANALYTICS);
  if (!allowed.allowed)
    return (
      <>
        <PageHeader title="Analytics" />
        <UpgradeNotice feature="Advanced analytics" decision={allowed} />
      </>
    );
  const requested = Number(str(sp, "days", "30"));
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;
  const a = await getProAnalytics(user.id, days);
  const totals = a.perListing.reduce(
    (t, l) => ({
      views: t.views + l.views,
      saves: t.saves + l.saves,
      inquiries: t.inquiries + l.inquiries,
    }),
    { views: 0, saves: 0, inquiries: 0 },
  );
  const day = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

  return (
    <>
      <PageHeader title="Analytics" description="How your listings and leads are performing." />
      <FilterTabs
        current={String(days)}
        tabs={RANGES.map((d) => ({
          value: String(d),
          label: `${d} days`,
          href: `/pro/analytics?days=${d}`,
        }))}
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KPI label="Listing views" value={formatNumber(totals.views)} />
        <KPI
          label="Saves"
          value={formatNumber(totals.saves)}
          hint={`${pct(totals.saves, totals.views)} of views`}
        />
        <KPI
          label="Inquiries & tours"
          value={formatNumber(totals.inquiries)}
          hint={`${pct(totals.inquiries, totals.views)} of views`}
        />
        <KPI
          label="Leads won"
          value={formatNumber(a.conversion.won)}
          hint={`${pct(a.conversion.won, a.conversion.total)} of ${a.conversion.total} new leads`}
        />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <LineChart
          title="Views of your listings"
          subtitle={`Daily, last ${days} days`}
          valueLabel="Views"
          data={a.daily.map((d) => ({ label: day(d.day), value: d.views }))}
        />
        <ColumnChart
          title="Inquiries & tour requests"
          subtitle={`Daily, last ${days} days`}
          valueLabel="Inquiries"
          data={a.daily.map((d) => ({ label: day(d.day), value: d.inquiries }))}
        />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Table>
          <thead>
            <tr>
              <Th>Listing</Th>
              <Th>Status</Th>
              <Th className="text-right">Views</Th>
              <Th className="text-right">Saves</Th>
              <Th className="text-right">Inquiries</Th>
              <Th className="text-right">Conversion</Th>
            </tr>
          </thead>
          <tbody>
            {a.perListing.length === 0 ? (
              <tr>
                <Td colSpan={6} className="text-muted py-8 text-center">
                  No listings yet.
                </Td>
              </tr>
            ) : null}
            {a.perListing.map((l) => (
              <tr key={l.id}>
                <Td>
                  <Link href={`/pro/listings/${l.id}`} className="hover:text-brand-600 font-medium">
                    {l.title}
                  </Link>
                </Td>
                <Td>
                  <StatusPill status={l.status} />
                </Td>
                <Td className="tabular text-right">{formatNumber(l.views)}</Td>
                <Td className="tabular text-right">{formatNumber(l.saves)}</Td>
                <Td className="tabular text-right">{formatNumber(l.inquiries)}</Td>
                <Td className="tabular text-right">{pct(l.inquiries, l.views)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Panel title="Lead sources" padded={false}>
          <ul className="divide-line divide-y">
            {a.sources.length === 0 ? (
              <li className="text-muted px-5 py-4 text-sm">No new leads in this period.</li>
            ) : null}
            {a.sources.map((s) => (
              <li key={s.source} className="flex justify-between px-5 py-2.5 text-sm">
                <span>{LEAD_SOURCE_LABELS[s.source] ?? s.source}</span>
                <span className="tabular font-medium">{s.n}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
