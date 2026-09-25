import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Bot, Shield, User } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { getUserInvestigation } from "@/server/trust/admin-queries";
import {
  liftRestrictionAction,
  revokeStrikeAction,
  revokeVerificationAction,
} from "@/server/actions/trust-admin";
import { ActionButton } from "@/components/admin/controls";
import {
  ChangeEmailForm,
  EnforcementForm,
  ManualVerifyForm,
  SetPasswordForm,
  StrikeForm,
} from "@/components/admin/trust-forms";
import { KPI, PageHeader, Panel, Pill, StatusPill } from "@/components/admin/ui";
import { Avatar } from "@/components/ui/misc";
import { formatDate, relativeTime } from "@/lib/format";
import { accountCapability, FEATURE_LABELS, VERIFICATION_LEVELS, type Role } from "@/lib/trust";

export const metadata = { title: "Account" };

const when = (d: Date) =>
  formatDate(d, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function UserInvestigationPage(props: PageProps<"/admin/users/[id]">) {
  const { id } = await props.params;
  const me = await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [data, trust] = await Promise.all([getUserInvestigation(id), getSettings("trust")]);
  if (!data) notFound();
  const { user: u } = data;
  const now = new Date();
  const cap = accountCapability(u.role as Role, u.verificationLevel);
  const canAct = u.id !== me.id && u.role !== "admin";
  const activeRestrictions = data.restrictions.filter(
    (r) => !r.liftedAt && r.startsAt <= now && (!r.endsAt || r.endsAt > now),
  );
  const ageDays = Math.floor((now.getTime() - u.createdAt.getTime()) / 86_400_000);
  const professional = ["agent", "broker", "property_manager", "developer"].includes(u.role);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/users" className="text-muted hover:text-ink">
          ← Users
        </Link>
      </p>
      <PageHeader
        title={u.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {u.email} · {u.role.replace("_", " ")} · joined {formatDate(u.createdAt)} ({ageDays}{" "}
            days)
          </span>
        }
        actions={
          <>
            <StatusPill status={u.status} />
            <Pill tone={cap.verified ? "green" : "gray"}>
              {cap.verified ? <BadgeCheck className="size-3" /> : null} Level {u.verificationLevel}
            </Pill>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KPI
          label="Verification"
          value={VERIFICATION_LEVELS[u.verificationLevel].name}
          hint={cap.label}
        />
        <KPI
          label="Status"
          value={u.status}
          hint={
            u.statusUntil ? `until ${formatDate(u.statusUntil)}` : (u.statusReason ?? undefined)
          }
        />
        <KPI
          label="Active strikes"
          value={data.activeStrikes}
          hint={`${trust.strikeWindowDays}-day window`}
        />
        <KPI
          label="Reports about them"
          value={data.reports.length}
          hint={`${data.listings.length} listings`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Active restrictions" padded={false}>
            {activeRestrictions.length === 0 ? (
              <p className="text-muted p-5 text-sm">None.</p>
            ) : (
              <ul className="divide-line divide-y">
                {activeRestrictions.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span>
                      <span className="font-medium">
                        {FEATURE_LABELS[r.feature as keyof typeof FEATURE_LABELS] ?? r.feature}
                      </span>
                      <span className="text-muted block text-xs">
                        {r.reason} ·{" "}
                        {r.endsAt ? `ends ${relativeTime(r.endsAt, now)}` : "until lifted"} ·{" "}
                        {r.source ? `rule ${r.source}` : "admin"}
                      </span>
                    </span>
                    <ActionButton action={liftRestrictionAction.bind(null, u.id, r.id)}>
                      Lift
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Verification checks" padded={false}>
            {data.checks.length === 0 ? (
              <p className="text-muted p-5 text-sm">No checks yet.</p>
            ) : null}
            <ul className="divide-line divide-y">
              {data.checks.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span>
                    <span className="font-medium capitalize">{v.kind}</span>{" "}
                    <span className="text-muted text-xs">
                      {v.provider} · {when(v.createdAt)}
                      {v.subject ? ` · ${v.subject}` : ""}
                      {v.decisionReason ? ` · ${v.decisionReason}` : ""}
                      {v.expiresAt && v.status === "approved"
                        ? ` · expires ${formatDate(v.expiresAt)}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusPill status={v.status === "approved" ? "active" : v.status} />
                    {v.status === "approved" ? (
                      <ActionButton
                        tone="danger"
                        confirm={`Revoke this ${v.kind} verification? Their level will drop.`}
                        action={revokeVerificationAction.bind(null, u.id, v.id)}
                      >
                        Revoke
                      </ActionButton>
                    ) : v.status === "pending" && v.kind !== "email" && v.kind !== "phone" ? (
                      <Link href="/admin/verifications" className="text-brand-600 text-xs">
                        Review →
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Strikes" padded={false}>
            {data.strikes.length === 0 ? <p className="text-muted p-5 text-sm">None.</p> : null}
            <ul className="divide-line divide-y">
              {data.strikes.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className={s.revokedAt ? "text-muted line-through" : ""}>
                    <span className="font-medium">{s.violationType.replace(/_/g, " ")}</span>{" "}
                    <span className="text-muted text-xs">
                      {s.reason} · {when(s.createdAt)} · {s.source ? `rule ${s.source}` : "admin"}
                    </span>
                  </span>
                  {!s.revokedAt ? (
                    <ActionButton action={revokeStrikeAction.bind(null, u.id, s.id)}>
                      Revoke
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Listings" padded={false}>
            {data.listings.length === 0 ? <p className="text-muted p-5 text-sm">None.</p> : null}
            <ul className="divide-line divide-y">
              {data.listings.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                >
                  <Link href={`/homes/${l.slug}`} className="hover:text-brand-600 truncate">
                    {l.title} <span className="text-muted text-xs">· {l.city}</span>
                  </Link>
                  <StatusPill status={l.status} />
                </li>
              ))}
            </ul>
          </Panel>

          {data.reports.length ? (
            <Panel title="Reports" padded={false}>
              <ul className="divide-line divide-y">
                {data.reports.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <span>
                      {r.reason}{" "}
                      <span className="text-muted text-xs">
                        · {r.targetType} · {relativeTime(r.createdAt, now)}
                      </span>
                    </span>
                    <StatusPill status={r.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="History"
            actions={
              <Link
                href={`/admin/audit?targetType=user&targetId=${u.id}`}
                className="text-brand-600 text-sm"
              >
                Full log
              </Link>
            }
            padded={false}
          >
            <ul className="divide-line divide-y">
              {data.history.map(({ a, actor }) => (
                <li key={a.id} className="flex gap-3 px-5 py-2.5 text-sm">
                  {a.actorType === "system" ? (
                    <Bot className="mt-0.5 size-4 shrink-0 text-sky-600" />
                  ) : a.actorType === "admin" ? (
                    <Shield className="text-brand-600 mt-0.5 size-4 shrink-0" />
                  ) : (
                    <User className="text-muted mt-0.5 size-4 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <code className="text-xs">{a.action}</code>{" "}
                    <span className="text-muted text-xs">
                      by {a.actorType === "system" ? a.actorLabel : (actor ?? "user")} ·{" "}
                      {when(a.createdAt)}
                    </span>
                    {a.reason ? <span className="text-ink-2 block text-xs">{a.reason}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          {canAct ? (
            <>
              <Panel
                title="Take action"
                description="Every action is audited and the user is notified."
              >
                <EnforcementForm userId={u.id} />
              </Panel>
              <Panel
                title="Add a strike"
                description={
                  trust.strikesEnabled
                    ? "The strike ladder applies automatically."
                    : "Strike ladder is off."
                }
              >
                <StrikeForm userId={u.id} types={trust.violationTypes} />
              </Panel>
              <Panel
                title="Manual verification"
                description="Override when you've verified someone yourself."
              >
                <ManualVerifyForm userId={u.id} professional={professional} />
              </Panel>
              <Panel
                title="Account: email"
                description="Admin override. Audited; the user is notified."
              >
                <ChangeEmailForm userId={u.id} email={u.email} />
              </Panel>
              <Panel
                title="Account: password"
                description="For locked-out users. Never shown or logged."
              >
                <SetPasswordForm userId={u.id} />
              </Panel>
            </>
          ) : (
            <Panel title="Take action">
              <p className="text-muted text-sm">
                {u.id === me.id
                  ? "This is your account."
                  : "Admins can't be actioned — change their role first."}
              </p>
            </Panel>
          )}
          <Panel
            title="Security signals"
            description="Context only. Shared networks are normal — never act on these alone."
          >
            <p className="text-muted text-xs">Signup IP: {u.signupIp ?? "not recorded"}</p>
            <ul className="mt-2 space-y-1.5 text-xs">
              {data.signals.slice(0, 8).map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span>
                    {s.kind} · {s.ipPrefix ?? "—"}
                  </span>
                  <span className="text-muted">{relativeTime(s.createdAt, now)}</span>
                </li>
              ))}
            </ul>
            {data.related.length ? (
              <>
                <p className="mt-4 text-xs font-semibold">
                  Other accounts seen on the same network or device
                </p>
                <ul className="mt-1.5 space-y-1.5 text-xs">
                  {data.related.map((r) => (
                    <li key={r.userId} className="flex items-center justify-between gap-2">
                      <Link
                        href={`/admin/users/${r.userId}`}
                        className="hover:text-brand-600 flex min-w-0 items-center gap-1.5"
                      >
                        <Avatar name={r.name} size={20} />
                        <span className="truncate">{r.email}</span>
                      </Link>
                      <span className="flex shrink-0 gap-1">
                        {r.sameDevice ? <Pill tone="amber">device</Pill> : null}
                        {r.sameNetwork ? <Pill>network</Pill> : null}
                        <StatusPill status={r.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
