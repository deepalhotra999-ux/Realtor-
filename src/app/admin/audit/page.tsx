import { listAudit } from "@/server/admin/queries";
import { PageHeader, Pagination, Table, Td, Th } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { page as getPage, type SP } from "@/lib/params";

export const metadata = { title: "Audit log" };

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  const sp = (await props.searchParams) as SP;
  const page = getPage(sp);
  const { rows, total } = await listAudit(page);
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every administrative change, who made it and when."
      />
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Target</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ a, actor }) => (
            <tr key={a.id}>
              <Td className="text-muted whitespace-nowrap">
                {formatDate(a.createdAt, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Td>
              <Td>{actor ?? "System"}</Td>
              <Td>
                <code className="text-xs">{a.action}</code>
              </Td>
              <Td className="text-xs">
                {a.targetType
                  ? `${a.targetType}${a.targetId ? ` · ${a.targetId.slice(0, 12)}` : ""}`
                  : "—"}
              </Td>
              <Td className="text-muted max-w-md truncate font-mono text-[11px]">
                {JSON.stringify(a.meta)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={50} total={total} href={(p) => `/admin/audit?page=${p}`} />
    </>
  );
}
