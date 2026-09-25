import Link from "next/link";
import { Video, MapPin } from "lucide-react";
import { requirePro } from "@/server/auth/session";
import { can } from "@/server/entitlements";
import { listMyTours } from "@/server/pro/queries";
import { setTourStatusAction } from "@/server/actions/pro";
import { ActionButton } from "@/components/admin/controls";
import { FilterTabs, PageHeader, StatusPill } from "@/components/admin/ui";
import { UpgradeNotice } from "@/components/pro/upgrade-notice";
import { EmptyState } from "@/components/ui/misc";
import { FEATURES } from "@/lib/entitlements/catalog";
import { formatDate } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Tours" };

export default async function ToursPage(props: PageProps<"/pro/tours">) {
  const sp = (await props.searchParams) as SP;
  const user = await requirePro();
  const allowed = await can(user.id, FEATURES.TOURS);
  if (!allowed.allowed)
    return (
      <>
        <PageHeader title="Tours" />
        <UpgradeNotice feature="Tour scheduling" decision={allowed} />
      </>
    );
  const scope = str(sp, "scope") === "past" ? "past" : "upcoming";
  const rows = await listMyTours(user.id, scope);

  // Group by calendar day for an agenda view.
  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = formatDate(r.t.scheduledAt, { weekday: "long", month: "long", day: "numeric" });
    days.set(key, [...(days.get(key) ?? []), r]);
  }

  return (
    <>
      <PageHeader
        title="Tours"
        description="Confirm requests quickly. Buyers are notified by email when you confirm or cancel."
      />
      <FilterTabs
        current={scope}
        tabs={[
          { value: "upcoming", label: "Upcoming", href: "/pro/tours" },
          { value: "past", label: "Past", href: "/pro/tours?scope=past" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState title={scope === "upcoming" ? "No upcoming tours" : "No past tours"}>
          Tour requests from your listing pages appear here.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...days].map(([day, items]) => (
            <section key={day}>
              <h2 className="text-muted mb-2 text-sm font-semibold">{day}</h2>
              <ul className="space-y-2">
                {items.map(({ t, listing, slug, street, city }) => (
                  <li
                    key={t.id}
                    className="border-line bg-surface shadow-card flex flex-wrap items-center gap-4 rounded-2xl border p-4"
                  >
                    <div className="w-20 shrink-0">
                      <p className="tabular text-lg font-semibold">
                        {formatDate(t.scheduledAt, { hour: "numeric", minute: "2-digit" })}
                      </p>
                      <p className="text-muted text-xs">{t.durationMinutes} min</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/homes/${slug}`} className="hover:text-brand-600 font-medium">
                        {listing}
                      </Link>
                      <p className="text-muted flex items-center gap-1 text-xs">
                        {t.type === "video" ? (
                          <Video className="size-3.5" />
                        ) : (
                          <MapPin className="size-3.5" />
                        )}
                        {t.type === "video" ? "Video tour" : `${street}, ${city}`}
                      </p>
                      <p className="mt-1 text-sm">
                        {t.contactName}
                        <span className="text-muted">
                          {" "}
                          · {t.contactEmail}
                          {t.contactPhone ? ` · ${t.contactPhone}` : ""}
                        </span>
                      </p>
                      {t.notes ? (
                        <p className="text-muted mt-1 text-xs italic">“{t.notes}”</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={t.status} />
                      {t.status === "requested" ? (
                        <ActionButton
                          tone="primary"
                          action={setTourStatusAction.bind(null, t.id, "confirmed")}
                        >
                          Confirm
                        </ActionButton>
                      ) : null}
                      {t.status === "confirmed" && scope === "past" ? (
                        <>
                          <ActionButton action={setTourStatusAction.bind(null, t.id, "completed")}>
                            Completed
                          </ActionButton>
                          <ActionButton action={setTourStatusAction.bind(null, t.id, "no_show")}>
                            No-show
                          </ActionButton>
                        </>
                      ) : null}
                      {t.status === "requested" || t.status === "confirmed" ? (
                        <ActionButton
                          tone="danger"
                          confirm="Cancel this tour? The requester will be notified."
                          action={setTourStatusAction.bind(null, t.id, "cancelled")}
                        >
                          Cancel
                        </ActionButton>
                      ) : null}
                      {t.leadId ? (
                        <Link
                          href={`/pro/leads/${t.leadId}`}
                          className="text-brand-600 text-xs font-medium"
                        >
                          Lead →
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
