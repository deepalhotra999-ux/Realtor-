import { listOutbound, PAGE_SIZE } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { describeProviders } from "@/providers";
import { TestEmailForm } from "@/components/admin/forms";
import { FilterTabs, PageHeader, Pagination, Panel, Pill, StatusPill } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { page as getPage, str, withParams, type SP } from "@/lib/params";

export const metadata = { title: "Notifications" };

export default async function NotificationsAdminPage(props: PageProps<"/admin/notifications">) {
  const sp = (await props.searchParams) as SP;
  const admin = await requireAdmin();
  const channel = str(sp, "channel", "all");
  const page = getPage(sp);
  const [{ rows, total }, providers] = await Promise.all([
    listOutbound(channel, page),
    describeProviders(),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Every outbound email and SMS is recorded here, whichever provider delivered it."
        actions={
          <>
            <Pill tone="green">Email: {providers.email}</Pill>
            <Pill tone="green">SMS: {providers.sms}</Pill>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          <FilterTabs
            current={channel}
            tabs={["all", "email", "sms", "push"].map((c) => ({
              value: c,
              label: c === "all" ? "All" : c === "sms" ? "SMS" : c[0].toUpperCase() + c.slice(1),
              href: withParams("/admin/notifications", sp, {
                channel: c === "all" ? undefined : c,
                page: undefined,
              }),
            }))}
          />
          <div className="border-line bg-surface shadow-card divide-line divide-y rounded-2xl border">
            {rows.length === 0 ? (
              <p className="text-muted p-6 text-center text-sm">Nothing sent yet.</p>
            ) : null}
            {rows.map((m) => (
              <details key={m.id} className="group px-5 py-3">
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm select-none">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {m.subject ?? m.body.slice(0, 80)}
                    </span>
                    <span className="text-muted text-xs">
                      {m.channel} to {m.to} · {m.provider} ·{" "}
                      {formatDate(m.createdAt, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <StatusPill status={m.status} />
                </summary>
                <div className="bg-paper mt-3 rounded-xl p-4 text-sm">
                  {m.error ? <p className="text-clay-600 mb-2 text-xs">{m.error}</p> : null}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              </details>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            href={(p) => withParams("/admin/notifications", sp, { page: p })}
          />
        </div>
        <div className="space-y-6">
          <Panel
            title="Test delivery"
            description="With the outbox provider, mail is recorded here instead of sent."
          >
            <TestEmailForm defaultTo={admin.email} />
          </Panel>
        </div>
      </div>
    </>
  );
}
