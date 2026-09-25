import { getAIStats } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { describeProviders } from "@/providers";
import { AIPlayground, AISettingsForm } from "@/components/admin/forms";
import { KPI, PageHeader, Panel, Pill, Table, Td, Th } from "@/components/admin/ui";
import { ColumnChart } from "@/components/charts";
import { formatNumber, relativeTime } from "@/lib/format";

export const metadata = { title: "AI" };

const FEATURE_LABELS: Record<string, string> = {
  naturalLanguageSearch: "Natural-language search",
  homeFinder: "AI Home Finder",
  propertyQA: "Property Q&A",
  listingDescriptions: "Listing writer",
  agentAssistant: "Agent assistant",
  comparisonSummaries: "Comparison summaries",
};

export default async function AIPage() {
  await requireAdmin();
  const [stats, settings, providers] = await Promise.all([
    getAIStats(),
    getSettings("ai"),
    describeProviders(),
  ]);
  const total = stats.byFeature.reduce((a, f) => a + f.n, 0);
  const failures = stats.byFeature.reduce((a, f) => a + f.failures, 0);
  const modelShare = total
    ? stats.byFeature.reduce((a, f) => a + f.modelShare * f.n, 0) / total
    : 0;
  const avgMs = total ? stats.byFeature.reduce((a, f) => a + f.avgMs * f.n, 0) / total : 0;
  const day = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <>
      <PageHeader
        title="AI"
        description="Local-first AI. Every feature is grounded in database facts and falls back to deterministic rules."
        actions={
          <Pill tone={providers.ai.kind === "llm" ? "green" : "amber"}>
            {providers.ai.name} · {providers.ai.model}
          </Pill>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KPI label="Requests (30 days)" value={formatNumber(total)} />
        <KPI
          label="Answered by a model"
          value={`${Math.round(modelShare * 100)}%`}
          hint="rest by rules"
        />
        <KPI label="Average latency" value={`${Math.round(avgMs)} ms`} />
        <KPI
          label="Failures"
          value={formatNumber(failures)}
          hint={total ? `${((failures / total) * 100).toFixed(1)}% of requests` : undefined}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <ColumnChart
            title="AI requests"
            subtitle="Daily, last 14 days"
            valueLabel="Requests"
            data={stats.daily.map((d) => ({ label: day(d.day), value: d.n }))}
          />
          <Table>
            <thead>
              <tr>
                <Th>Feature</Th>
                <Th className="text-right">Requests</Th>
                <Th className="text-right">Model share</Th>
                <Th className="text-right">Avg latency</Th>
                <Th className="text-right">Failures</Th>
              </tr>
            </thead>
            <tbody>
              {stats.byFeature.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="text-muted py-6 text-center">
                    No AI requests in the last 30 days.
                  </Td>
                </tr>
              ) : null}
              {stats.byFeature.map((f) => (
                <tr key={f.feature}>
                  <Td className="font-medium">{FEATURE_LABELS[f.feature] ?? f.feature}</Td>
                  <Td className="tabular text-right">{formatNumber(f.n)}</Td>
                  <Td className="tabular text-right">{Math.round(f.modelShare * 100)}%</Td>
                  <Td className="tabular text-right">{f.avgMs} ms</Td>
                  <Td className="tabular text-right">{f.failures}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Panel title="Recent requests" padded={false}>
            <ul className="divide-line divide-y">
              {stats.recent.map(({ a, user }) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{FEATURE_LABELS[a.feature] ?? a.feature}</span>
                    <span className="text-muted"> · {user ?? "anonymous"}</span>
                    {a.error ? (
                      <span className="text-clay-600 block truncate text-xs">{a.error}</span>
                    ) : null}
                  </span>
                  <span className="text-muted flex shrink-0 items-center gap-2 text-xs">
                    <Pill tone={a.success ? (a.provider === "rules" ? "gray" : "green") : "red"}>
                      {a.provider}
                    </Pill>
                    {a.latencyMs} ms · {relativeTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Feature switches">
            <AISettingsForm s={settings} />
          </Panel>
          <Panel
            title="Playground"
            description="Send a raw prompt to the active provider. Not metered, not grounded."
          >
            <AIPlayground />
          </Panel>
        </div>
      </div>
    </>
  );
}
