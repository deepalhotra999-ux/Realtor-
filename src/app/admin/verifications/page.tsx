import Link from "next/link";
import { FileText } from "lucide-react";
import { requireAdmin } from "@/server/auth/session";
import { listVerificationQueue } from "@/server/trust/admin-queries";
import { DecideVerificationForm } from "@/components/admin/trust-forms";
import { FilterTabs, PageHeader, Panel, Pill, StatusPill } from "@/components/admin/ui";
import { formatDate, relativeTime } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Verification queue" };

const LABELS: Record<string, string> = {
  legalName: "Legal name",
  documentType: "Document",
  documentCountry: "Issuing country",
  licenseNumber: "License #",
  licenseState: "License state",
  brokerageName: "Brokerage",
};

export default async function VerificationsPage(props: PageProps<"/admin/verifications">) {
  const sp = (await props.searchParams) as SP;
  await requireAdmin();
  const status = str(sp, "status", "pending");
  const { rows, counts } = await listVerificationQueue(status);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Verification queue"
        description="Identity and license checks waiting for a decision. Approving raises the user's level; badges follow automatically."
      />
      <FilterTabs
        current={status}
        tabs={["pending", "approved", "rejected", "expired", "all"].map((s) => ({
          value: s,
          label: s,
          count: s === "all" ? undefined : (counts[s] ?? 0),
          href: `/admin/verifications?status=${s}`,
        }))}
      />
      {rows.length === 0 ? <p className="text-muted text-sm">Nothing here.</p> : null}
      <div className="space-y-3">
        {rows.map(({ v, name, email, role, level, accountCreated }) => (
          <Panel key={v.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  <span className="capitalize">{v.kind}</span> check ·{" "}
                  <Link href={`/admin/users/${v.userId}`} className="text-brand-600">
                    {name}
                  </Link>
                </p>
                <p className="text-muted text-xs">
                  {email} · {role.replace("_", " ")} · level {level} · account{" "}
                  {relativeTime(accountCreated, now)} · submitted {formatDate(v.createdAt)}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <Pill>{v.provider}</Pill>
                <StatusPill status={v.status === "approved" ? "active" : v.status} />
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {Object.entries(v.data as Record<string, string>)
                .filter(([k]) => k in LABELS)
                .map(([k, val]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-muted w-32 shrink-0">{LABELS[k]}</dt>
                    <dd>{String(val).replace(/_/g, " ")}</dd>
                  </div>
                ))}
            </dl>
            {v.documentKeys.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {v.documentKeys.map((_, i) => (
                  <a
                    key={i}
                    href={`/api/admin/verification-docs/${v.id}/${i}`}
                    target="_blank"
                    rel="noreferrer"
                    className="border-line hover:bg-paper inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
                  >
                    <FileText className="size-3.5" /> Document {i + 1}
                  </a>
                ))}
              </div>
            ) : v.status !== "pending" ? (
              <p className="text-muted mt-3 text-xs">
                Documents deleted after the retention period.
              </p>
            ) : null}
            {v.kind === "license" ? (
              <p className="text-muted mt-2 text-xs">
                Tip: confirm the number in the state licensing board&apos;s public lookup before
                approving.
              </p>
            ) : null}
            {v.status === "pending" ? (
              <div className="border-line mt-4 border-t pt-4">
                <DecideVerificationForm id={v.id} />
              </div>
            ) : v.decisionReason ? (
              <p className="text-muted mt-3 text-xs">
                Decision: {v.decisionReason}
                {v.reviewedAt ? ` · ${formatDate(v.reviewedAt)}` : ""}
              </p>
            ) : null}
          </Panel>
        ))}
      </div>
    </>
  );
}
