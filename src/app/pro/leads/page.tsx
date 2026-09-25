import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requirePro } from "@/server/auth/session";
import { can } from "@/server/entitlements";
import { listMyLeads } from "@/server/pro/queries";
import { updateLeadStageAction } from "@/server/actions/pro";
import { ActionSelect } from "@/components/admin/controls";
import { FilterTabs, PageHeader, Panel, Pill, Table, Td, Th } from "@/components/admin/ui";
import { NewLeadForm } from "@/components/pro/lead-forms";
import { UpgradeNotice } from "@/components/pro/upgrade-notice";
import { Input } from "@/components/ui/input";
import { FEATURES } from "@/lib/entitlements/catalog";
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS, LEAD_STAGES, PIPELINE_STAGES } from "@/lib/crm";
import { relativeTime } from "@/lib/format";
import { str, withParams, type SP } from "@/lib/params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };

const STAGE_OPTS = LEAD_STAGES.map((s) => ({ value: s, label: LEAD_STAGE_LABELS[s] }));

function scoreTone(score: number) {
  return score >= 70 ? "green" : score >= 45 ? "amber" : "gray";
}

export default async function LeadsPage(props: PageProps<"/pro/leads">) {
  const sp = (await props.searchParams) as SP;
  const user = await requirePro();
  const crm = await can(user.id, FEATURES.CRM);
  if (!crm.allowed)
    return (
      <>
        <PageHeader title="Leads" />
        <UpgradeNotice feature="The lead CRM" decision={crm} />
      </>
    );

  const view = str(sp, "view", "board") === "list" ? "list" : "board";
  const q = str(sp, "q");
  const stage = str(sp, "stage", "all");
  const rows = await listMyLeads(user.id, { q, stage: view === "list" ? stage : "all" });
  const now = new Date();

  return (
    <>
      <PageHeader title="Leads" description="Every inquiry and tour request lands here." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          current={view}
          tabs={[
            {
              value: "board",
              label: "Pipeline",
              href: withParams("/pro/leads", sp, { view: undefined }),
            },
            { value: "list", label: "List", href: withParams("/pro/leads", sp, { view: "list" }) },
          ]}
        />
        <form className="relative mb-4 w-full max-w-xs">
          {view === "list" ? <input type="hidden" name="view" value="list" /> : null}
          {stage !== "all" ? <input type="hidden" name="stage" value={stage} /> : null}
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input name="q" defaultValue={q} placeholder="Search leads" className="h-10 pl-9" />
        </form>
      </div>

      {view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          <div className="flex gap-3">
            {PIPELINE_STAGES.map((s) => {
              const col = rows.filter((r) => r.stage === s);
              return (
                <section key={s} className="bg-paper-2/70 w-72 shrink-0 rounded-2xl p-2">
                  <h2 className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
                    {LEAD_STAGE_LABELS[s]}
                    <span className="text-muted tabular text-xs">{col.length}</span>
                  </h2>
                  <ul className="mt-1 space-y-2">
                    {col.slice(0, 50).map((l) => (
                      <li
                        key={l.id}
                        className="border-line bg-surface rounded-xl border p-3 shadow-sm"
                      >
                        <Link
                          href={`/pro/leads/${l.id}`}
                          className="hover:text-brand-600 block font-medium"
                        >
                          {l.name}
                        </Link>
                        <p className="text-muted mt-0.5 truncate text-xs">
                          {l.listing ?? LEAD_SOURCE_LABELS[l.source]}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Pill tone={scoreTone(l.score)}>{l.score}</Pill>
                          {l.nextFollowUpAt ? (
                            <span
                              className={cn(
                                "text-xs",
                                l.nextFollowUpAt < now ? "text-clay-600 font-medium" : "text-muted",
                              )}
                            >
                              {l.nextFollowUpAt < now ? "Overdue" : "Follow up"}{" "}
                              {relativeTime(l.nextFollowUpAt, now)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2">
                          <ActionSelect
                            label={`Stage for ${l.name}`}
                            value={l.stage}
                            options={STAGE_OPTS}
                            action={updateLeadStageAction.bind(null, l.id)}
                          />
                        </div>
                      </li>
                    ))}
                    {col.length === 0 ? (
                      <li className="text-subtle px-2 py-6 text-center text-xs">Empty</li>
                    ) : null}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <FilterTabs
            current={stage}
            tabs={[{ value: "all", label: "All stages" }, ...STAGE_OPTS].map((t) => ({
              ...t,
              href: withParams("/pro/leads", sp, {
                stage: t.value === "all" ? undefined : t.value,
              }),
            }))}
          />
          <Table>
            <thead>
              <tr>
                <Th>Lead</Th>
                <Th>Listing / source</Th>
                <Th>Score</Th>
                <Th>Stage</Th>
                <Th>Follow-up</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-muted py-8 text-center">
                    No leads match.
                  </Td>
                </tr>
              ) : null}
              {rows.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <Link href={`/pro/leads/${l.id}`} className="hover:text-brand-600 font-medium">
                      {l.name}
                    </Link>
                    <p className="text-muted text-xs">{l.email ?? l.phone}</p>
                  </Td>
                  <Td className="text-muted max-w-56 truncate">
                    {l.listing ?? LEAD_SOURCE_LABELS[l.source]}
                  </Td>
                  <Td>
                    <Pill tone={scoreTone(l.score)}>{l.score}</Pill>
                  </Td>
                  <Td>
                    <ActionSelect
                      label={`Stage for ${l.name}`}
                      value={l.stage}
                      options={STAGE_OPTS}
                      action={updateLeadStageAction.bind(null, l.id)}
                    />
                  </Td>
                  <Td
                    className={
                      l.nextFollowUpAt && l.nextFollowUpAt < now ? "text-clay-600" : "text-muted"
                    }
                  >
                    {l.nextFollowUpAt ? relativeTime(l.nextFollowUpAt, now) : "—"}
                  </Td>
                  <Td className="text-muted">{relativeTime(l.createdAt, now)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      <Panel className="mt-6 max-w-4xl">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold select-none">
            <Plus className="size-4" /> Add a lead
          </summary>
          <div className="border-line mt-4 border-t pt-4">
            <NewLeadForm />
          </div>
        </details>
      </Panel>
    </>
  );
}
