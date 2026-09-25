import { Bot, Search, Shield, User } from "lucide-react";
import { listAudit } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { FilterTabs, PageHeader, Pagination, Table, Td, Th } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { page as getPage, str, withParams, type SP } from "@/lib/params";

export const metadata = { title: "Audit log" };

function fmt(v: unknown) {
  if (v === null || v === undefined) return "∅";
  return typeof v === "string" ? v : JSON.stringify(v);
}

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  const sp = (await props.searchParams) as SP;
  await requireAdmin();
  const page = getPage(sp);
  const actorType = str(sp, "actor", "all");
  const filters = {
    actorType,
    targetType: str(sp, "targetType") || undefined,
    targetId: str(sp, "targetId") || undefined,
    q: str(sp, "q") || undefined,
  };
  const { rows, total } = await listAudit(page, filters);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every automated and manual action: who or which rule did it, why, and what changed."
      />
      <div className="flex flex-wrap items-start gap-3">
        <FilterTabs
          current={actorType}
          tabs={[
            { value: "all", label: "Everyone" },
            { value: "system", label: "Automation" },
            { value: "admin", label: "Admins" },
            { value: "user", label: "Users" },
          ].map((t) => ({
            ...t,
            href: withParams("/admin/audit", sp, {
              actor: t.value === "all" ? undefined : t.value,
              page: undefined,
            }),
          }))}
        />
        <form className="relative mb-4 w-full max-w-xs">
          {actorType !== "all" ? <input type="hidden" name="actor" value={actorType} /> : null}
          {filters.targetType ? (
            <input type="hidden" name="targetType" value={filters.targetType} />
          ) : null}
          {filters.targetId ? (
            <input type="hidden" name="targetId" value={filters.targetId} />
          ) : null}
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Filter by action, e.g. listing."
            className="h-10 pl-9"
          />
        </form>
      </div>
      {filters.targetId ? (
        <p className="text-muted mb-3 text-sm">
          Showing history for {filters.targetType} <code>{filters.targetId}</code> ·{" "}
          <a className="text-brand-600" href="/admin/audit">
            clear
          </a>
        </p>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Target</Th>
            <Th>Reason / change</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ a, actor }) => {
            const changes = a.after ? Object.keys(a.after) : [];
            return (
              <tr key={a.id}>
                <Td className="text-muted text-xs whitespace-nowrap">
                  {formatDate(a.createdAt, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Td>
                <Td className="text-xs">
                  <span className="flex items-center gap-1.5">
                    {a.actorType === "system" ? (
                      <Bot className="size-3.5 text-sky-600" />
                    ) : a.actorType === "admin" ? (
                      <Shield className="text-brand-600 size-3.5" />
                    ) : (
                      <User className="text-muted size-3.5" />
                    )}
                    {a.actorType === "system" ? (
                      <code>{a.actorLabel ?? "system"}</code>
                    ) : (
                      (actor ?? "deleted user")
                    )}
                  </span>
                  {a.ip ? <span className="text-subtle block text-[11px]">{a.ip}</span> : null}
                </Td>
                <Td>
                  <code className="text-xs">{a.action}</code>
                </Td>
                <Td className="text-xs">
                  {a.targetType ? (
                    <a
                      className="hover:text-brand-600"
                      href={withParams(
                        "/admin/audit",
                        {},
                        { targetType: a.targetType, targetId: a.targetId ?? undefined },
                      )}
                    >
                      {a.targetType}
                      {a.targetId ? ` · ${a.targetId.slice(0, 12)}` : ""}
                    </a>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="max-w-md text-xs">
                  {a.reason ? <p className="mb-1">{a.reason}</p> : null}
                  {changes.length ? (
                    <ul className="space-y-0.5 font-mono text-[11px]">
                      {changes.slice(0, 6).map((k) => (
                        <li key={k} className="truncate">
                          <span className="text-muted">{k}:</span> {fmt(a.before?.[k])} →{" "}
                          {fmt(a.after?.[k])}
                        </li>
                      ))}
                    </ul>
                  ) : Object.keys(a.meta).length ? (
                    <p className="text-muted truncate font-mono text-[11px]">
                      {JSON.stringify(a.meta)}
                    </p>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pagination
        page={page}
        pageSize={50}
        total={total}
        href={(p) => withParams("/admin/audit", sp, { page: p })}
      />
    </>
  );
}
