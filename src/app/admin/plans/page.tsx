import { Plus } from "lucide-react";
import { listFeaturesAdmin, listPlansAdmin } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { deleteFeatureAction, deletePlanAction } from "@/server/actions/admin";
import { ActionButton } from "@/components/admin/controls";
import { FeatureForm, PlanForm } from "@/components/admin/forms";
import { PageHeader, Panel, Pill, Table, Td, Th } from "@/components/admin/ui";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Plans & features" };

export default async function PlansPage() {
  await requireAdmin();
  const [plans, features, monetization] = await Promise.all([
    listPlansAdmin(),
    listFeaturesAdmin(),
    getSettings("monetization"),
  ]);
  const featureOpts = features.map((f) => ({
    key: f.key,
    name: f.name,
    kind: f.kind,
    unit: f.unit,
    category: f.category,
  }));
  const featureName = new Map(features.map((f) => [f.key, f.name]));

  return (
    <>
      <PageHeader
        title="Plans & features"
        description={
          monetization.subscriptionsEnabled
            ? "Subscriptions are ON: paid features are enforced from these plans."
            : "Subscriptions are OFF: plans are kept but not enforced. Everything is free."
        }
        actions={
          <Pill tone={monetization.subscriptionsEnabled ? "blue" : "green"}>
            {monetization.paidFeatures.length} paid feature
            {monetization.paidFeatures.length === 1 ? "" : "s"}
          </Pill>
        }
      />

      <div className="space-y-4">
        {plans.map((p) => {
          const enabled = Object.entries(p.entitlements).filter(([, e]) => e.enabled);
          return (
            <Panel
              key={p.id}
              title={p.name}
              description={p.description || undefined}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.isDefault ? <Pill tone="green">default</Pill> : null}
                  {p.highlight ? <Pill tone="amber">recommended</Pill> : null}
                  {!p.isActive ? <Pill tone="red">archived</Pill> : null}
                  {!p.isPublic ? <Pill>hidden</Pill> : null}
                  <Pill tone="blue">{p.audience.replace("_", " ")}</Pill>
                </div>
              }
            >
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                <p>
                  <span className="text-lg font-semibold">{formatCents(p.priceMonthly)}</span>
                  <span className="text-muted">/mo</span>
                  <span className="text-muted"> · {formatCents(p.priceAnnual)}/yr</span>
                </p>
                <p className="text-muted">
                  {p.trialDays ? `${p.trialDays}-day trial` : "Platform-default trial"}
                </p>
                <p className="text-muted">
                  <code className="text-xs">{p.key}</code> · {p.subscribers} subscriber
                  {p.subscribers === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {enabled.length === 0 ? (
                  <span className="text-muted text-xs">No entitlements</span>
                ) : (
                  enabled.map(([key, e]) => (
                    <Pill key={key}>
                      {featureName.get(key) ?? key}
                      {e.limit !== null ? ` · ${e.limit}` : ""}
                    </Pill>
                  ))
                )}
              </div>
              <details className="group mt-4">
                <summary className="text-brand-600 cursor-pointer text-sm font-medium select-none">
                  Edit plan
                </summary>
                <div className="border-line mt-4 border-t pt-4">
                  <PlanForm plan={{ ...p, entitlements: p.entitlements }} features={featureOpts} />
                  <div className="border-line mt-5 flex items-center justify-between gap-3 border-t pt-4">
                    <p className="text-muted text-xs">
                      Plans with subscription history are archived instead of deleted.
                    </p>
                    <ActionButton
                      tone="danger"
                      confirm={`Delete or archive “${p.name}”?`}
                      action={deletePlanAction.bind(null, p.id)}
                    >
                      {p.subscribers > 0 ? "Archive" : "Delete"}
                    </ActionButton>
                  </div>
                </div>
              </details>
            </Panel>
          );
        })}

        <Panel>
          <details>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold select-none">
              <Plus className="size-4" /> New plan
            </summary>
            <div className="border-line mt-4 border-t pt-4">
              <PlanForm features={featureOpts} />
            </div>
          </details>
        </Panel>
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Feature catalogue</h2>
      <p className="text-muted mb-4 max-w-2xl text-sm">
        Gateable capabilities. Code checks these keys; plans grant them. Mark a feature as paid in
        Settings → Monetization.
      </p>
      <Table>
        <thead>
          <tr>
            <Th>Feature</Th>
            <Th>Kind</Th>
            <Th>Category</Th>
            <Th>Paid</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.key}>
              <Td>
                <p className="font-medium">{f.name}</p>
                <code className="text-muted text-xs">{f.key}</code>
              </Td>
              <Td className="text-muted">
                {f.kind}
                {f.unit ? ` (${f.unit})` : ""}
              </Td>
              <Td className="text-muted">{f.category}</Td>
              <Td>
                {monetization.paidFeatures.includes(f.key) ? (
                  <Pill tone="blue">paid</Pill>
                ) : (
                  <Pill tone="green">free</Pill>
                )}
              </Td>
              <Td className="text-right">
                <ActionButton
                  tone="danger"
                  confirm={`Delete feature “${f.key}”? Plans lose this entitlement.`}
                  action={deleteFeatureAction.bind(null, f.key)}
                >
                  Delete
                </ActionButton>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Panel title="Add a feature" className="mt-4 max-w-3xl">
        <FeatureForm />
      </Panel>
    </>
  );
}
