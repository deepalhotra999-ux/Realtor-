import { Plus } from "lucide-react";
import { listFlagsAdmin } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { deleteFlagAction, toggleFlagAction } from "@/server/actions/admin";
import { ActionButton, Toggle } from "@/components/admin/controls";
import { FlagForm } from "@/components/admin/forms";
import { PageHeader, Panel, Pill } from "@/components/admin/ui";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Feature flags" };

export default async function FlagsPage() {
  await requireAdmin();
  const flags = await listFlagsAdmin();

  return (
    <>
      <PageHeader
        title="Feature flags"
        description="Ship dark, roll out gradually. Users are bucketed deterministically, so a user stays in or out as the percentage grows."
      />
      <div className="space-y-3">
        {flags.length === 0 ? <p className="text-muted text-sm">No flags yet.</p> : null}
        {flags.map((f) => (
          <Panel key={f.key}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <code className="font-semibold">{f.key}</code>
                  {f.enabled ? <Pill tone="green">on</Pill> : <Pill>off</Pill>}
                  {f.rolloutPercent < 100 ? (
                    <Pill tone="amber">{f.rolloutPercent}% rollout</Pill>
                  ) : null}
                  {f.roles.map((r) => (
                    <Pill key={r} tone="blue">
                      {r.replace("_", " ")}
                    </Pill>
                  ))}
                </p>
                {f.description ? <p className="text-muted mt-1 text-sm">{f.description}</p> : null}
                <p className="text-subtle mt-1 text-xs">Updated {relativeTime(f.updatedAt)}</p>
              </div>
              <Toggle
                label={`Toggle ${f.key}`}
                checked={f.enabled}
                action={toggleFlagAction.bind(null, f.key)}
              />
            </div>
            <details className="mt-3">
              <summary className="text-brand-600 cursor-pointer text-sm font-medium select-none">
                Edit
              </summary>
              <div className="border-line mt-3 border-t pt-4">
                <FlagForm flag={f} />
                <div className="border-line mt-4 flex justify-end border-t pt-3">
                  <ActionButton
                    tone="danger"
                    confirm={`Delete flag “${f.key}”? Code checking it will treat it as off.`}
                    action={deleteFlagAction.bind(null, f.key)}
                  >
                    Delete flag
                  </ActionButton>
                </div>
              </div>
            </details>
          </Panel>
        ))}
        <Panel>
          <details>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold select-none">
              <Plus className="size-4" /> New flag
            </summary>
            <div className="border-line mt-4 border-t pt-4">
              <FlagForm />
            </div>
          </details>
        </Panel>
      </div>
    </>
  );
}
