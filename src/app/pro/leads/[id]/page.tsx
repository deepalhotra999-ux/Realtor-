import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
} from "lucide-react";
import { z } from "zod";
import { requirePro } from "@/server/auth/session";
import { can } from "@/server/entitlements";
import { getLead } from "@/server/pro/queries";
import { completeTaskAction, updateLeadStageAction } from "@/server/actions/pro";
import { messageLeadAction } from "@/server/actions/messages";
import { ActionButton, ActionSelect } from "@/components/admin/controls";
import { PageHeader, Panel, Pill, StatusPill } from "@/components/admin/ui";
import { ActivityForm, EmailLeadForm } from "@/components/pro/lead-forms";
import { UpgradeNotice } from "@/components/pro/upgrade-notice";
import { FEATURES } from "@/lib/entitlements/catalog";
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS, LEAD_STAGES } from "@/lib/crm";
import { formatDate, formatPrice, relativeTime } from "@/lib/format";

export const metadata = { title: "Lead" };

const ICONS = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: CalendarClock,
  task: CheckCircle2,
  stage_change: Circle,
} as const;

export default async function LeadPage(props: PageProps<"/pro/leads/[id]">) {
  const { id } = await props.params;
  const user = await requirePro();
  const crm = await can(user.id, FEATURES.CRM);
  if (!crm.allowed) return <UpgradeNotice feature="The lead CRM" decision={crm} />;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const data = await getLead(user.id, id);
  if (!data) notFound();
  const { lead, listing, activities, tours } = data;
  const tasks = activities.filter(({ a }) => a.type === "task");
  const timeline = activities.filter(({ a }) => a.type !== "task");
  const now = new Date();

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/pro/leads" className="text-muted hover:text-ink">
          ← Leads
        </Link>
      </p>
      <PageHeader
        title={lead.name}
        description={
          <>
            {LEAD_SOURCE_LABELS[lead.source]} · received {relativeTime(lead.createdAt, now)}
            {listing ? (
              <>
                {" "}
                ·{" "}
                <Link href={`/homes/${listing.slug}`} className="text-brand-600">
                  {listing.title}
                </Link>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Pill tone={lead.score >= 70 ? "green" : lead.score >= 45 ? "amber" : "gray"}>
              Score {lead.score}
            </Pill>
            <ActionSelect
              label="Stage"
              value={lead.stage}
              options={LEAD_STAGES.map((s) => ({ value: s, label: LEAD_STAGE_LABELS[s] }))}
              action={updateLeadStageAction.bind(null, lead.id)}
            />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {lead.message ? (
            <Panel title="Their message">
              <p className="text-sm whitespace-pre-wrap">{lead.message}</p>
            </Panel>
          ) : null}

          {lead.email ? (
            <Panel title="Email" description="Sent through the platform and logged on this lead.">
              <EmailLeadForm
                leadId={lead.id}
                email={lead.email}
                defaultSubject={listing ? `Re: ${listing.title}` : "Following up"}
              />
            </Panel>
          ) : null}

          <Panel title="Log activity">
            <ActivityForm leadId={lead.id} />
          </Panel>

          <Panel title="Timeline" padded={false}>
            {timeline.length === 0 ? (
              <p className="text-muted p-5 text-sm">No activity yet.</p>
            ) : (
              <ol className="divide-line divide-y">
                {timeline.map(({ a, actor }) => {
                  const Icon = ICONS[a.type];
                  return (
                    <li key={a.id} className="flex gap-3 px-5 py-3.5">
                      <Icon className="text-muted mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-muted text-xs">
                          <span className="text-ink-2 font-medium capitalize">
                            {a.type === "stage_change" ? "Stage change" : a.type}
                          </span>{" "}
                          · {actor ?? "System"} · {relativeTime(a.createdAt, now)}
                        </p>
                        {a.body ? (
                          <p className="mt-1 text-sm whitespace-pre-wrap">
                            {a.type === "stage_change"
                              ? a.body.replace(
                                  /(\w+)/g,
                                  (s) =>
                                    LEAD_STAGE_LABELS[s as keyof typeof LEAD_STAGE_LABELS] ?? s,
                                )
                              : a.body}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Contact">
            <dl className="space-y-2 text-sm">
              {lead.email ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Email</dt>
                  <dd className="truncate">
                    <a href={`mailto:${lead.email}`} className="text-brand-600">
                      {lead.email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {lead.phone ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Phone</dt>
                  <dd>
                    <a href={`tel:${lead.phone}`} className="text-brand-600">
                      {lead.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Looking to</dt>
                <dd>{lead.intent === "rent" ? "Rent" : lead.intent === "sale" ? "Buy" : "—"}</dd>
              </div>
              {lead.budgetMax ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Budget</dt>
                  <dd>
                    {lead.budgetMin ? `${formatPrice(lead.budgetMin)} – ` : "up to "}
                    {formatPrice(lead.budgetMax)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last contact</dt>
                <dd>{lead.lastContactAt ? relativeTime(lead.lastContactAt, now) : "Never"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Next follow-up</dt>
                <dd
                  className={
                    lead.nextFollowUpAt && lead.nextFollowUpAt < now
                      ? "text-clay-600 font-medium"
                      : ""
                  }
                >
                  {lead.nextFollowUpAt ? relativeTime(lead.nextFollowUpAt, now) : "—"}
                </dd>
              </div>
            </dl>
            {lead.contactUserId ? (
              <form action={messageLeadAction.bind(null, lead.id)} className="mt-4">
                <button
                  type="submit"
                  className="border-line hover:bg-paper inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border text-sm font-medium"
                >
                  <MessageSquare className="size-4" /> Message in Dwellwise
                </button>
              </form>
            ) : null}
          </Panel>

          <Panel title="Tasks" padded={false}>
            {tasks.length === 0 ? (
              <p className="text-muted p-5 text-sm">No tasks. Add one from “Log activity”.</p>
            ) : (
              <ul className="divide-line divide-y">
                {tasks.map(({ a }) => (
                  <li key={a.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                    <ActionButton
                      action={completeTaskAction.bind(null, a.id)}
                      className="size-7 justify-center rounded-full px-0"
                    >
                      {a.completedAt ? (
                        <CheckCircle2 className="text-brand-600 size-4" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                      <span className="sr-only">Toggle done</span>
                    </ActionButton>
                    <div className="min-w-0">
                      <p className={a.completedAt ? "text-muted line-through" : ""}>{a.body}</p>
                      {a.dueAt ? (
                        <p
                          className={
                            !a.completedAt && a.dueAt < now
                              ? "text-clay-600 text-xs"
                              : "text-muted text-xs"
                          }
                        >
                          Due{" "}
                          {formatDate(a.dueAt, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {tours.length ? (
            <Panel title="Tours" padded={false}>
              <ul className="divide-line divide-y">
                {tours.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span>
                      {formatDate(t.scheduledAt, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      <span className="text-muted block text-xs">
                        {t.type === "video" ? "Video tour" : "In person"}
                      </span>
                    </span>
                    <StatusPill status={t.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
