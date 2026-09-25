import Link from "next/link";
import { Search } from "lucide-react";
import { listUsers, PAGE_SIZE } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { setUserRoleAction, setUserStatusAction } from "@/server/actions/admin";
import { ActionButton, ActionSelect } from "@/components/admin/controls";
import {
  FilterTabs,
  PageHeader,
  Pagination,
  Pill,
  StatusPill,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { Avatar } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { page as getPage, str, withParams, type SP } from "@/lib/params";

export const metadata = { title: "Users" };

const ROLE_OPTS = [
  { value: "consumer", label: "Consumer" },
  { value: "agent", label: "Agent" },
  { value: "broker", label: "Broker" },
  { value: "property_manager", label: "Property manager" },
  { value: "developer", label: "Developer" },
  { value: "admin", label: "Admin" },
];

export default async function UsersPage(props: PageProps<"/admin/users">) {
  const sp = (await props.searchParams) as SP;
  const me = await requireAdmin();
  const role = str(sp, "role", "all");
  const q = str(sp, "q");
  const page = getPage(sp);
  const { rows, total, roleCounts } = await listUsers({ q, role, page });
  const all = Object.values(roleCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage roles and account status. Suspending a user signs them out everywhere."
      />
      <FilterTabs
        current={role}
        tabs={[
          { value: "all", label: "All", count: all },
          ...ROLE_OPTS.map((r) => ({
            value: r.value,
            label: r.label,
            count: roleCounts[r.value] ?? 0,
          })),
        ].map((t) => ({
          ...t,
          href: withParams("/admin/users", sp, {
            role: t.value === "all" ? undefined : t.value,
            page: undefined,
          }),
        }))}
      />
      <form className="relative mb-4 max-w-sm">
        {role !== "all" ? <input type="hidden" name="role" value={role} /> : null}
        <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input name="q" defaultValue={q} placeholder="Search name or email" className="h-10 pl-9" />
      </form>
      <Table>
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Plan</Th>
            <Th>Listings</Th>
            <Th>Joined</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} size={32} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      <Link href={`/admin/users/${u.id}`} className="hover:text-brand-600">
                        {u.name}
                      </Link>
                      {u.id === me.id ? (
                        <span className="text-muted ml-1.5 text-xs">(you)</span>
                      ) : null}
                    </p>
                    <p className="text-muted truncate text-xs">{u.email}</p>
                  </div>
                </div>
              </Td>
              <Td>
                {u.id === me.id ? (
                  <Pill tone="dark">admin</Pill>
                ) : (
                  <ActionSelect
                    label={`Role for ${u.name}`}
                    value={u.role}
                    options={ROLE_OPTS}
                    action={setUserRoleAction.bind(null, u.id)}
                  />
                )}
              </Td>
              <Td>
                <StatusPill status={u.status} />
                <p className="text-muted mt-1 text-xs">Level {u.level}</p>
              </Td>
              <Td>
                {u.plan ? (
                  <Pill tone="blue">{u.plan}</Pill>
                ) : (
                  <span className="text-muted">Free</span>
                )}
              </Td>
              <Td className="tabular">{u.listings}</Td>
              <Td className="text-muted">{formatDate(u.createdAt)}</Td>
              <Td className="text-right">
                {u.id === me.id ? null : u.status === "suspended" ? (
                  <ActionButton action={setUserStatusAction.bind(null, u.id, "active")}>
                    Reactivate
                  </ActionButton>
                ) : (
                  <ActionButton
                    tone="danger"
                    confirm={`Suspend ${u.name}? They'll be signed out.`}
                    action={setUserStatusAction.bind(null, u.id, "suspended")}
                  >
                    Suspend
                  </ActionButton>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        href={(p) => withParams("/admin/users", sp, { page: p })}
      />
    </>
  );
}
