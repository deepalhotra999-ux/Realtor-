import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CheckCircle2, Circle, Clock, ShieldAlert, XCircle } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { getVerificationSummary } from "@/server/trust/verification";
import { activeRestrictions } from "@/server/trust/enforcement";
import { getMyAgentProfile } from "@/server/pro/queries";
import { simulateDecisionAction } from "@/server/actions/verification";
import { getIdentityVerification } from "@/providers";
import { CodeVerifier, IdentityForm, LicenseForm } from "@/components/account/verification-forms";
import { ActionButton } from "@/components/admin/controls";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { str, type SP } from "@/lib/params";
import {
  accountCapability,
  FEATURE_LABELS,
  publishDecision,
  VERIFICATION_LEVELS,
  type Role,
} from "@/lib/trust";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Verify your account" };

const PROFESSIONAL = ["agent", "broker", "property_manager", "developer"];

function Step({
  done,
  title,
  status,
  children,
}: {
  done: boolean;
  title: string;
  status?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          {done ? (
            <CheckCircle2 className="text-brand-600 size-5" />
          ) : (
            <Circle className="text-subtle size-5" />
          )}
          {title}
        </h2>
        {status}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </Card>
  );
}

function CheckStatus({
  check,
  simulate,
}: {
  check: {
    id: string;
    status: string;
    decisionReason: string | null;
    expiresAt: Date | null;
    createdAt: Date;
  } | null;
  simulate: boolean;
}) {
  if (!check) return null;
  if (check.status === "approved")
    return (
      <span className="text-brand-700 text-xs">
        Verified{check.expiresAt ? ` · renews by ${formatDate(check.expiresAt)}` : ""}
      </span>
    );
  if (check.status === "pending")
    return (
      <span className="flex flex-col items-end gap-1.5">
        <span className="text-gold-700 flex items-center gap-1 text-xs">
          <Clock className="size-3.5" /> In review since {formatDate(check.createdAt)}
        </span>
        {simulate ? (
          <span className="flex gap-1">
            <ActionButton action={simulateDecisionAction.bind(null, check.id, "approved")}>
              Simulate approve
            </ActionButton>
            <ActionButton
              tone="danger"
              action={simulateDecisionAction.bind(null, check.id, "rejected")}
            >
              Simulate reject
            </ActionButton>
          </span>
        ) : null}
      </span>
    );
  return (
    <span className="text-clay-600 flex items-center gap-1 text-xs">
      <XCircle className="size-3.5" />{" "}
      {check.status === "rejected" ? `Not approved: ${check.decisionReason ?? ""}` : "Expired"}
    </span>
  );
}

export default async function VerificationPage(props: PageProps<"/account/verification">) {
  const sp = (await props.searchParams) as SP;
  const user = await requireUser("/account/verification");
  const [s, trust, restrictions, profile] = await Promise.all([
    getVerificationSummary(user.id),
    getSettings("trust"),
    activeRestrictions(user.id),
    PROFESSIONAL.includes(user.role) ? getMyAgentProfile(user.id) : null,
  ]);
  const level = s.user.level;
  const role = user.role as Role;
  const cap = accountCapability(role, level);
  const publish = publishDecision(role, level, trust);
  const simulate = getIdentityVerification().allowsSimulation;
  const next = str(sp, "next");
  const professional = PROFESSIONAL.includes(user.role);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {str(sp, "welcome") ? (
        <p className="bg-brand-50 text-brand-700 mb-6 rounded-xl p-4 text-sm">
          Welcome to Dwellwise! Confirm your email to start messaging and contacting agents.
          {next && next !== "/" ? (
            <>
              {" "}
              <Link href={next} className="font-semibold underline">
                Skip for now
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <h1 className="font-display text-4xl">Verify your account</h1>
      <p className="text-muted mt-2">
        Verification protects buyers and renters from scams. Each level unlocks more of the
        marketplace, and badges only appear once a check has actually passed.
      </p>

      {user.status !== "active" || restrictions.length ? (
        <Card className="border-clay-100 bg-clay-50/60 mt-6 p-5">
          <p className="text-clay-600 flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-5" /> Account notices
          </p>
          <ul className="text-ink-2 mt-2 space-y-1 text-sm">
            {user.status === "warned" ? <li>Your account has an active warning.</li> : null}
            {restrictions.map((r) => (
              <li key={r.id}>
                Restricted from{" "}
                {FEATURE_LABELS[r.feature as keyof typeof FEATURE_LABELS] ?? r.feature}
                {r.endsAt ? ` until ${formatDate(r.endsAt)}` : ""} — {r.reason}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-muted text-sm">Your level</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              Level {level} · {VERIFICATION_LEVELS[level].name}
              {cap.verified ? <BadgeCheck className="text-brand-600 size-6" /> : null}
            </p>
            <p className="text-muted mt-1 text-sm">Shown to others as: {cap.label}</p>
          </div>
          <p className="text-sm">
            {publish.allowed ? (
              <span className="text-brand-700">
                You can publish listings{publish.needsReview ? " (reviewed before going live)" : ""}
                .
              </span>
            ) : publish.reason === "level" ? (
              <span className="text-muted">
                Publishing listings unlocks at level {publish.requiredLevel}.
              </span>
            ) : null}
          </p>
        </div>
        <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-4">
          {VERIFICATION_LEVELS.map((l) => (
            <li
              key={l.level}
              className={cn(
                "rounded-xl border p-3 text-xs",
                l.level <= level ? "border-brand-200 bg-brand-50/60" : "border-line",
              )}
            >
              <p className="font-semibold">Level {l.level}</p>
              <p className="text-muted mt-0.5">{l.description}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-6 space-y-4">
        <Step
          done={Boolean(s.user.emailVerifiedAt)}
          title="Email address"
          status={
            s.user.emailVerifiedAt ? <span className="text-brand-700 text-xs">Verified</span> : null
          }
        >
          {s.user.emailVerifiedAt ? null : (
            <CodeVerifier kind="email" target={s.user.email} pending={s.emailPending} />
          )}
        </Step>

        <Step
          done={Boolean(s.user.phoneVerifiedAt)}
          title={`Mobile number${trust.requirePhoneForLevel1 ? "" : " (optional)"}`}
          status={
            s.user.phoneVerifiedAt ? (
              <span className="text-brand-700 text-xs">Verified · {s.user.phone}</span>
            ) : null
          }
        >
          {s.user.phoneVerifiedAt ? null : (
            <CodeVerifier kind="phone" target={s.user.phone} pending={s.phonePending} />
          )}
        </Step>

        <Step
          done={s.identity?.status === "approved"}
          title="Identity (level 2)"
          status={<CheckStatus check={s.identity} simulate={simulate} />}
        >
          {level < 1 ? (
            <p className="text-muted text-sm">Verify your email first.</p>
          ) : !s.identity || ["rejected", "expired"].includes(s.identity.status) ? (
            <IdentityForm />
          ) : null}
        </Step>

        {professional ? (
          <Step
            done={s.license?.status === "approved"}
            title="Professional license (level 3)"
            status={<CheckStatus check={s.license} simulate={simulate} />}
          >
            {level < 2 ? (
              <p className="text-muted text-sm">Verify your identity first.</p>
            ) : !s.license || ["rejected", "expired"].includes(s.license.status) ? (
              <LicenseForm
                defaults={{
                  licenseNumber: profile?.p.licenseNumber,
                  licenseState: profile?.p.licenseState,
                  brokerage: profile?.brokerage,
                }}
              />
            ) : null}
          </Step>
        ) : null}
      </div>

      <p className="text-muted mt-8 text-xs">
        Checks are reviewed by our team using {getIdentityVerification().name}. Documents are
        visible only to reviewers and deleted {trust.documentRetentionDays} days after a decision.
        {simulate ? " Development mode: simulated decisions are enabled." : ""}
      </p>
      {next ? (
        <div className="mt-6">
          <ButtonLink href={next} variant="secondary">
            Continue
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
