import Link from "next/link";
import { listLeadsAdmin, PAGE_SIZE } from "@/server/admin/queries";
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
import { relativeTime } from "@/lib/format";
import { page as getPage, str, withParams, type SP } from "@/lib/params";

export const metadata = { title: "Leads" };

const STAGES = [
  "new",
  "contacted",
  "qualified",
  "touring",
  "offer",
  "under_contract",
  "closed_won",
  "closed_lost",
];

export default async function LeadsAdmin(props: PageProps<"/admin/leads">) {
  const sp = (await props.searchParams) as SP;
  const stage = str(sp, "stage", "all");
  const page = getPage(sp);
  const { rows, total, stageCounts, sources } = await listLeadsAdmin({ stage, page });
  const all = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const maxSource = Math.max(1, ...sources.map((s) => s.n));
  return (
    <>
      <PageHeader
        title="Leads"
        description="Platform-wide view of every inquiry and where it is in each agent's pipeline."
      />
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <FilterTabs
            current={stage}
            tabs={[
              { value: "all", label: "All", count: all },
              ...STAGES.map((s) => ({
                value: s,
                label: s.replace("_", " "),
                count: stageCounts[s] ?? 0,
              })),
            ].map((t) => ({
              ...t,
              href: withParams("/admin/leads", sp, {
                stage: t.value === "all" ? undefined : t.value,
                page: undefined,
              }),
            }))}
          />
          <Table>
            <thead>
              <tr>
                <Th>Contact</Th>
                <Th>Listing</Th>
                <Th>Owner</Th>
                <Th>Source</Th>
                <Th>Score</Th>
                <Th>Stage</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-muted text-xs">{l.email}</p>
                  </Td>
                  <Td className="max-w-56 truncate">
                    {l.listingSlug ? (
                      <Link href={`/homes/${l.listingSlug}`} className="hover:underline">
                        {l.listing}
                      </Link>
                    ) : (
                      <span className="text-muted">Profile inquiry</span>
                    )}
                  </Td>
                  <Td>{l.owner}</Td>
                  <Td className="text-xs">{l.source.replace("_", " ")}</Td>
                  <Td className="tabular">{l.score}</Td>
                  <Td>
                    <StatusPill status={l.stage} />
                  </Td>
                  <Td className="text-muted">{relativeTime(l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            href={(p) => withParams("/admin/leads", sp, { page: p })}
          />
        </div>
        <Panel title="Lead sources" className="self-start">
          <ul className="space-y-3">
            {sources.map((s) => (
              <li key={s.source}>
                <div className="flex justify-between text-sm">
                  <span>{s.source.replace("_", " ")}</span>
                  <span className="tabular text-muted">{s.n}</span>
                </div>
                <div className="bg-brand-50 mt-1 h-2 rounded-full">
                  <div
                    className="bg-brand-600 h-2 rounded-full"
                    style={{ width: `${(s.n / maxSource) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
