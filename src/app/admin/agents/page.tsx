import Link from "next/link";
import { Star } from "lucide-react";
import { listAgentsAdmin, PAGE_SIZE } from "@/server/admin/queries";
import { setAgentVerifiedAction } from "@/server/actions/admin";
import { Toggle } from "@/components/admin/controls";
import {
  FilterTabs,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { page as getPage, str, withParams, type SP } from "@/lib/params";

export const metadata = { title: "Agents & brokers" };

export default async function AgentsAdmin(props: PageProps<"/admin/agents">) {
  const sp = (await props.searchParams) as SP;
  const verified = str(sp, "verified", "all");
  const page = getPage(sp);
  const { rows, total, brokerages } = await listAgentsAdmin({ q: str(sp, "q"), verified, page });
  return (
    <>
      <PageHeader
        title="Agents & brokers"
        description="Verify licenses and monitor performance. Verification shows a badge on public profiles."
      />
      <FilterTabs
        current={verified}
        tabs={[
          { value: "all", label: "All" },
          { value: "no", label: "Unverified" },
          { value: "yes", label: "Verified" },
        ].map((t) => ({
          ...t,
          href: withParams("/admin/agents", sp, {
            verified: t.value === "all" ? undefined : t.value,
            page: undefined,
          }),
        }))}
      />
      <Table>
        <thead>
          <tr>
            <Th>Agent</Th>
            <Th>Brokerage</Th>
            <Th>License</Th>
            <Th>Rating</Th>
            <Th>Active</Th>
            <Th>Leads 30d</Th>
            <Th>Verified</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <Td>
                <Link href={`/agents/${a.slug}`} className="font-medium hover:underline">
                  {a.name}
                </Link>
                <p className="text-muted text-xs">
                  {a.email} · {a.role.replace("_", " ")}
                </p>
              </Td>
              <Td>{a.brokerage ?? <span className="text-muted">Independent</span>}</Td>
              <Td className="text-xs">
                {a.licenseNumber ? (
                  `${a.licenseNumber} (${a.licenseState})`
                ) : (
                  <Pill tone="amber">missing</Pill>
                )}
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1">
                  <Star className="fill-gold-500 text-gold-500 size-3.5" />
                  {a.reviewCount ? a.ratingAvg.toFixed(1) : "—"}{" "}
                  <span className="text-muted text-xs">({a.reviewCount})</span>
                </span>
              </Td>
              <Td className="tabular">{a.activeListings}</Td>
              <Td className="tabular">{a.leads30}</Td>
              <Td>
                <Toggle
                  checked={a.verified}
                  label={`Verify ${a.name}`}
                  action={setAgentVerifiedAction.bind(null, a.id)}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        href={(p) => withParams("/admin/agents", sp, { page: p })}
      />

      <Panel title="Brokerages" className="mt-8" padded={false}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Market</Th>
              <Th>Agents</Th>
              <Th>Active listings</Th>
            </tr>
          </thead>
          <tbody>
            {brokerages.map((b) => (
              <tr key={b.id}>
                <Td className="font-medium">{b.name}</Td>
                <Td>
                  {b.city}, {b.state}
                </Td>
                <Td className="tabular">{b.agents}</Td>
                <Td className="tabular">{b.listings}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
