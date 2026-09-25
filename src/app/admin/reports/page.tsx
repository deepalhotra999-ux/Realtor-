import Link from "next/link";
import { listReportsAdmin } from "@/server/admin/queries";
import { resolveReportAction, setListingStatusAction } from "@/server/actions/admin";
import { ActionButton } from "@/components/admin/controls";
import { FilterTabs, PageHeader, Pill, StatusPill } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/misc";
import { relativeTime } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Reports" };

export default async function ReportsAdmin(props: PageProps<"/admin/reports">) {
  const sp = (await props.searchParams) as SP;
  const status = str(sp, "status", "open");
  const rows = await listReportsAdmin(status);
  return (
    <>
      <PageHeader
        title="Trust & safety reports"
        description="Reports submitted by visitors about listings, reviews and users."
      />
      <FilterTabs
        current={status}
        tabs={["open", "resolved", "dismissed", "all"].map((s) => ({
          value: s,
          label: s[0].toUpperCase() + s.slice(1),
          href: `/admin/reports?status=${s}`,
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState title="No reports">Nothing needs review right now.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ r, reporter, listing }) => (
            <li key={r.id} className="border-line bg-surface shadow-card rounded-2xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Pill
                      tone={r.reason === "fraud" || r.reason === "discrimination" ? "red" : "amber"}
                    >
                      {r.reason}
                    </Pill>
                    <span className="text-sm font-medium">{r.targetType}</span>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="mt-2 text-sm">
                    {listing ? (
                      <Link href={`/homes/${listing.slug}`} className="font-medium underline">
                        {listing.title}
                      </Link>
                    ) : (
                      <code className="text-xs">{r.targetId}</code>
                    )}
                  </p>
                  {r.details ? <p className="text-ink-2 mt-1 text-sm">“{r.details}”</p> : null}
                  <p className="text-muted mt-2 text-xs">
                    By {reporter ?? "anonymous visitor"} · {relativeTime(r.createdAt)}
                    {r.resolution ? ` · ${r.resolution}` : ""}
                  </p>
                </div>
                {r.status === "open" || r.status === "reviewing" ? (
                  <div className="flex flex-wrap gap-2">
                    {listing ? (
                      <ActionButton
                        tone="danger"
                        confirm="Take this listing off the market?"
                        action={async () => {
                          "use server";
                          await setListingStatusAction(listing.id, "off_market");
                          await resolveReportAction(r.id, "resolved", "Listing taken down");
                        }}
                      >
                        Take listing down
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      tone="primary"
                      action={resolveReportAction.bind(null, r.id, "resolved", "Resolved")}
                    >
                      Resolve
                    </ActionButton>
                    <ActionButton
                      action={resolveReportAction.bind(null, r.id, "dismissed", "No violation")}
                    >
                      Dismiss
                    </ActionButton>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
