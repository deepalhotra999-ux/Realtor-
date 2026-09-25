import { listSubscriptions, PAGE_SIZE } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { cancelSubscriptionAdminAction, extendTrialAction } from "@/server/actions/admin";
import { ActionButton } from "@/components/admin/controls";
import { GrantPlanForm } from "@/components/admin/forms";
import {
  FilterTabs,
  PageHeader,
  Pagination,
  Panel,
  StatusPill,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { formatCents, formatDate, relativeTime } from "@/lib/format";
import { page as getPage, str, withParams, type SP } from "@/lib/params";

export const metadata = { title: "Subscriptions & trials" };

const STATUSES = ["trialing", "active", "past_due", "canceled", "expired"] as const;

export default async function SubscriptionsPage(props: PageProps<"/admin/subscriptions">) {
  const sp = (await props.searchParams) as SP;
  await requireAdmin();
  const status = str(sp, "status", "all");
  const page = getPage(sp);
  const { rows, total, counts, plans, payments } = await listSubscriptions(status, page);
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Subscriptions & trials"
        description="Grant plans, extend trials and cancel subscriptions. Payments run through the configured PaymentProvider."
      />
      <FilterTabs
        current={status}
        tabs={[
          { value: "all", label: "All", count: all },
          ...STATUSES.map((s) => ({
            value: s,
            label: s.replace("_", " "),
            count: counts[s] ?? 0,
          })),
        ].map((t) => ({
          ...t,
          href: withParams("/admin/subscriptions", sp, {
            status: t.value === "all" ? undefined : t.value,
            page: undefined,
          }),
        }))}
      />
      <Table>
        <thead>
          <tr>
            <Th>Subscriber</Th>
            <Th>Plan</Th>
            <Th>Status</Th>
            <Th>Period ends</Th>
            <Th>Provider</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <Td className="text-muted py-8 text-center" colSpan={6}>
                No subscriptions yet.
              </Td>
            </tr>
          ) : null}
          {rows.map(({ s, email, name, plan, priceMonthly, priceAnnual }) => {
            const live = ["trialing", "active", "past_due"].includes(s.status);
            return (
              <tr key={s.id}>
                <Td>
                  <p className="font-medium">{name}</p>
                  <p className="text-muted text-xs">{email}</p>
                </Td>
                <Td>
                  <p>{plan}</p>
                  <p className="text-muted text-xs">
                    {s.interval === "year"
                      ? `${formatCents(priceAnnual)}/yr`
                      : `${formatCents(priceMonthly)}/mo`}
                  </p>
                </Td>
                <Td>
                  <StatusPill status={s.status} />
                  {s.cancelAtPeriodEnd && s.status !== "expired" ? (
                    <p className="text-muted mt-1 text-xs">ends at period end</p>
                  ) : null}
                </Td>
                <Td className="text-muted">
                  {s.status === "trialing" && s.trialEndsAt ? (
                    <>
                      Trial {relativeTime(s.trialEndsAt)}
                      <br />
                      <span className="text-xs">{formatDate(s.trialEndsAt)}</span>
                    </>
                  ) : (
                    formatDate(s.currentPeriodEnd)
                  )}
                </Td>
                <Td className="text-muted text-xs">{s.provider}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {s.status !== "expired" ? (
                      <ActionButton action={extendTrialAction.bind(null, s.id, 7)}>
                        +7 day trial
                      </ActionButton>
                    ) : null}
                    {live && !s.cancelAtPeriodEnd ? (
                      <ActionButton
                        confirm={`Cancel ${email}'s subscription at the end of the period?`}
                        action={cancelSubscriptionAdminAction.bind(null, s.id, false)}
                      >
                        Cancel
                      </ActionButton>
                    ) : null}
                    {s.status !== "expired" ? (
                      <ActionButton
                        tone="danger"
                        confirm={`End ${email}'s access immediately?`}
                        action={cancelSubscriptionAdminAction.bind(null, s.id, true)}
                      >
                        End now
                      </ActionButton>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        href={(p) => withParams("/admin/subscriptions", sp, { page: p })}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Grant a plan"
          description="Comp a plan or start a trial for any user. Replaces their current subscription."
        >
          {plans.length ? (
            <GrantPlanForm plans={plans} />
          ) : (
            <p className="text-muted text-sm">Create a plan first.</p>
          )}
        </Panel>
        <Panel title="Recent payments" padded={false}>
          {payments.length === 0 ? (
            <p className="text-muted p-5 text-sm">No payments recorded.</p>
          ) : (
            <ul className="divide-line divide-y">
              {payments.map(({ p, email }) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{email}</span>
                    <span className="text-muted text-xs">
                      {p.description ?? "Payment"} · {p.provider} · {relativeTime(p.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular font-medium">{formatCents(p.amount, p.currency)}</span>
                    <StatusPill status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
