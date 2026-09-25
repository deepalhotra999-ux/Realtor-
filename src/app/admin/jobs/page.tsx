import { CircleAlert, CircleCheck, Play } from "lucide-react";
import { getJobsOverview } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import {
  retryJobAction,
  runScheduleNowAction,
  setScheduleEnabledAction,
} from "@/server/actions/admin";
import { ActionButton, Toggle } from "@/components/admin/controls";
import { ScheduleIntervalForm } from "@/components/admin/forms";
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
import { formatDate, formatNumber, relativeTime } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Background jobs" };

const STATUSES = ["queued", "running", "succeeded", "dead"] as const;

export default async function JobsPage(props: PageProps<"/admin/jobs">) {
  const sp = (await props.searchParams) as SP;
  await requireAdmin();
  const status = str(sp, "status", "all");
  const o = await getJobsOverview(status);
  const now = new Date();
  // A healthy worker drains due jobs within seconds and finishes something at least every 15 min.
  const lagMs = o.oldestQueued ? now.getTime() - o.oldestQueued.getTime() : 0;
  const healthy =
    lagMs < 5 * 60_000 &&
    o.lastFinished !== null &&
    now.getTime() - o.lastFinished.getTime() < 30 * 60_000;
  const all = Object.values(o.counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Background jobs"
        description={
          <>
            Automation runs in the worker process (<code>pnpm worker</code>), independent of anyone
            being signed in. You can pause, retime or run any schedule.
          </>
        }
        actions={
          healthy ? (
            <span className="text-brand-700 flex items-center gap-1.5 text-sm font-medium">
              <CircleCheck className="size-4" /> Worker healthy
            </span>
          ) : (
            <span className="text-clay-600 flex items-center gap-1.5 text-sm font-medium">
              <CircleAlert className="size-4" />
              {o.lastFinished ? "Worker may be stopped" : "Worker hasn't run yet"}
            </span>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KPI
          label="Queued"
          value={formatNumber(o.counts.queued ?? 0)}
          hint={lagMs > 0 ? `oldest due ${relativeTime(o.oldestQueued!, now)}` : "none waiting"}
        />
        <KPI label="Running" value={formatNumber(o.counts.running ?? 0)} />
        <KPI
          label="Succeeded"
          value={formatNumber(o.counts.succeeded ?? 0)}
          hint={o.lastFinished ? `last ${relativeTime(o.lastFinished, now)}` : undefined}
        />
        <KPI label="Dead (needs review)" value={formatNumber(o.counts.dead ?? 0)} />
      </div>

      <h2 className="mt-8 mb-3 font-semibold">Schedules</h2>
      <Table>
        <thead>
          <tr>
            <Th>Schedule</Th>
            <Th>Every</Th>
            <Th>Last run</Th>
            <Th>Next run</Th>
            <Th>Enabled</Th>
            <Th className="text-right">Run</Th>
          </tr>
        </thead>
        <tbody>
          {o.schedules.length === 0 ? (
            <tr>
              <Td colSpan={6} className="text-muted py-6 text-center">
                No schedules yet — they&apos;re created when the worker first starts.
              </Td>
            </tr>
          ) : null}
          {o.schedules.map((s) => (
            <tr key={s.name}>
              <Td>
                <p className="font-medium">{s.name}</p>
                <p className="text-muted text-xs">{s.description}</p>
                <code className="text-subtle text-[11px]">{s.jobType}</code>
              </Td>
              <Td>
                <ScheduleIntervalForm name={s.name} seconds={s.intervalSeconds} />
              </Td>
              <Td className="text-muted text-xs">
                {s.lastRunAt ? relativeTime(s.lastRunAt, now) : "never"}
              </Td>
              <Td className="text-muted text-xs">
                {s.enabled ? relativeTime(s.nextRunAt, now) : "paused"}
              </Td>
              <Td>
                <Toggle
                  label={`Enable ${s.name}`}
                  checked={s.enabled}
                  action={setScheduleEnabledAction.bind(null, s.name)}
                />
              </Td>
              <Td className="text-right">
                <ActionButton action={runScheduleNowAction.bind(null, s.name)}>
                  <Play className="size-3.5" /> Run now
                </ActionButton>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h2 className="mt-8 mb-3 font-semibold">Recent jobs</h2>
      <FilterTabs
        current={status}
        tabs={[
          { value: "all", label: "All", count: all },
          ...STATUSES.map((s) => ({ value: s, label: s, count: o.counts[s] ?? 0 })),
        ].map((t) => ({
          ...t,
          href: t.value === "all" ? "/admin/jobs" : `/admin/jobs?status=${t.value}`,
        }))}
      />
      <Panel padded={false}>
        {o.recent.length === 0 ? <p className="text-muted p-5 text-sm">No jobs.</p> : null}
        <ul className="divide-line divide-y">
          {o.recent.map((j) => (
            <li key={j.id} className="px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0">
                  <code className="font-medium">{j.type}</code>
                  <span className="text-muted ml-2 text-xs">
                    created{" "}
                    {formatDate(j.createdAt, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    {" · "}attempt {j.attempts}/{j.maxAttempts}
                    {j.status === "queued" && j.runAt > now
                      ? ` · retry ${relativeTime(j.runAt, now)}`
                      : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill status={j.status === "dead" ? "failed" : j.status} />
                  {j.status === "dead" ? (
                    <ActionButton action={retryJobAction.bind(null, j.id)}>Retry</ActionButton>
                  ) : null}
                </span>
              </div>
              {j.result ? (
                <p className="text-muted mt-1 font-mono text-[11px]">{JSON.stringify(j.result)}</p>
              ) : null}
              {j.lastError ? (
                <details className="mt-1">
                  <summary className="text-clay-600 cursor-pointer text-xs">
                    {j.lastError.split("\n")[0].slice(0, 160)}
                  </summary>
                  <pre className="bg-paper mt-1 overflow-x-auto rounded-lg p-2 text-[11px]">
                    {j.lastError}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
