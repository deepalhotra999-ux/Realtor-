import Link from "next/link";
import { getAnalytics } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { FilterTabs, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { ColumnChart, LineChart } from "@/components/charts";
import { formatNumber } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  const sp = (await props.searchParams) as SP;
  await requireAdmin();
  const requested = Number(str(sp, "days", "30"));
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;
  const a = await getAnalytics(days);
  const day = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const top = a.funnel[0]?.n ?? 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="First-party product events. No third-party trackers."
      />
      <FilterTabs
        current={String(days)}
        tabs={RANGES.map((d) => ({
          value: String(d),
          label: `${d} days`,
          href: `/admin/analytics?days=${d}`,
        }))}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <LineChart
          title="Listing views"
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

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Conversion funnel" description="Distinct visitors reaching each step.">
          <ol className="space-y-3">
            {a.funnel.map((s, i) => {
              const pct = top ? (s.n / top) * 100 : 0;
              return (
                <li key={s.step}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span>
                      <span className="text-muted tabular mr-2">{i + 1}.</span>
                      {s.step}
                    </span>
                    <span className="tabular font-medium">
                      {formatNumber(s.n)}
                      {i > 0 ? (
                        <span className="text-muted ml-2 text-xs">{pct.toFixed(1)}%</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="bg-paper-2 h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-brand-600 h-full rounded-full"
                      style={{ width: `${Math.max(pct, s.n ? 1 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
        <Panel title="Events by type" padded={false}>
          <ul className="divide-line divide-y">
            {a.byType.length === 0 ? (
              <li className="text-muted px-5 py-4 text-sm">No events recorded.</li>
            ) : null}
            {a.byType.map((e) => (
              <li key={e.type} className="flex justify-between px-5 py-2.5 text-sm">
                <code className="text-xs">{e.type}</code>
                <span className="tabular font-medium">{formatNumber(e.n)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div>
          <h2 className="mb-3 font-semibold">Most viewed listings</h2>
          <Table>
            <thead>
              <tr>
                <Th>Listing</Th>
                <Th>City</Th>
                <Th className="text-right">Views</Th>
              </tr>
            </thead>
            <tbody>
              {a.topListings.length === 0 ? (
                <tr>
                  <Td colSpan={3} className="text-muted py-6 text-center">
                    No views in this period.
                  </Td>
                </tr>
              ) : null}
              {a.topListings.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <Link href={`/homes/${l.slug}`} className="hover:text-brand-600 font-medium">
                      {l.title}
                    </Link>
                  </Td>
                  <Td className="text-muted">{l.city}</Td>
                  <Td className="tabular text-right">{formatNumber(l.views)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Panel title="Top searched cities" padded={false}>
          <ul className="divide-line divide-y">
            {a.searchCities.length === 0 ? (
              <li className="text-muted px-5 py-4 text-sm">No place searches recorded.</li>
            ) : null}
            {a.searchCities.map((c) => (
              <li key={c.city} className="flex justify-between px-5 py-2.5 text-sm">
                <span>{c.city}</span>
                <span className="tabular font-medium">{formatNumber(c.n)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
