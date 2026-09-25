"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import {
  addStrikeAction,
  decideVerificationAction,
  enforceAction,
  manualVerifyAction,
  saveTrustSettingsAction,
  setUserPasswordAction,
  updateUserEmailAction,
  type TrustAdminState,
} from "@/server/actions/trust-admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { submitKeepingValues } from "@/components/ui/form-submit";
import { RESTRICTABLE_FEATURES, STRIKE_ACTIONS, type TrustSettings } from "@/lib/settings-schema";
import { FEATURE_LABELS } from "@/lib/trust";

function Status({ state }: { state: TrustAdminState }) {
  if (!state) return null;
  return state.error ? (
    <p className="bg-clay-50 text-clay-600 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <TriangleAlert className="size-4 shrink-0" /> {state.error}
    </p>
  ) : state.message ? (
    <p className="bg-brand-50 text-brand-700 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <CheckCircle2 className="size-4 shrink-0" /> {state.message}
    </p>
  ) : null;
}

const ACTION_HELP: Record<string, string> = {
  warn: "Adds a warning the user can see. Doesn't limit anything.",
  restrict: "Blocks specific features. Everything else keeps working.",
  suspend: "Signs them out and blocks sign-in. Their listings are hidden.",
  ban: "Permanently closes the account. Their listings are hidden.",
  reinstate: "Restores full access and lifts every restriction.",
};

export function EnforcementForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(enforceAction.bind(null, userId), undefined);
  const [kind, setKind] = useState("warn");
  const timed = kind === "warn" || kind === "restrict" || kind === "suspend";
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <Field label="Action" hint={ACTION_HELP[kind]}>
        <Select
          name="action"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-10"
        >
          <option value="warn">Warn</option>
          <option value="restrict">Restrict features</option>
          <option value="suspend">Suspend</option>
          <option value="ban">Ban permanently</option>
          <option value="reinstate">Reinstate (restore access)</option>
        </Select>
      </Field>
      {kind === "restrict" ? (
        <fieldset className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {RESTRICTABLE_FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="features" value={f} className="accent-brand-600" />
              {FEATURE_LABELS[f]}
            </label>
          ))}
        </fieldset>
      ) : null}
      {timed ? (
        <Field
          label="Duration (days)"
          hint="Blank = until an admin lifts it. Access returns automatically when it ends."
        >
          <Input name="days" type="number" min={1} max={3650} className="h-10 w-32" />
        </Field>
      ) : null}
      <Field label="Reason" hint="Shown to the user and kept in the audit log.">
        <Textarea name="reason" rows={2} required />
      </Field>
      <Button
        type="submit"
        size="sm"
        variant={kind === "ban" || kind === "suspend" ? "danger" : "primary"}
        disabled={pending}
      >
        {pending ? "Applying…" : "Apply"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function StrikeForm({ userId, types }: { userId: string; types: string[] }) {
  const [state, action, pending] = useActionState(addStrikeAction.bind(null, userId), undefined);
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <Field label="Violation">
        <Select name="violationType" className="h-10">
          {types.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason">
        <Input name="reason" required className="h-10" />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Recording…" : "Add strike"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function ManualVerifyForm({
  userId,
  professional,
}: {
  userId: string;
  professional: boolean;
}) {
  const [state, action, pending] = useActionState(manualVerifyAction.bind(null, userId), undefined);
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <Field label="Mark as verified">
        <Select name="kind" className="h-10">
          <option value="email">Email</option>
          <option value="identity">Identity</option>
          {professional ? <option value="license">Professional license</option> : null}
        </Select>
      </Field>
      <Field label="How you checked" hint="Recorded in the audit log.">
        <Input
          name="reason"
          required
          placeholder="e.g. Checked state license lookup"
          className="h-10"
        />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Mark verified"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function ChangeEmailForm({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState(
    updateUserEmailAction.bind(null, userId),
    undefined,
  );
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <Field label="Email" hint="Used to sign in. The old address is told about the change.">
        <Input name="email" type="email" required defaultValue={email} className="h-10" />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="markVerified" className="accent-brand-600 mt-0.5 size-4" />
        <span>
          I&apos;ve confirmed the user controls this address
          <span className="text-muted block text-xs">
            Otherwise it&apos;s unverified until they enter a code.
          </span>
        </span>
      </label>
      <Field label="Reason">
        <Input
          name="reason"
          required
          placeholder="e.g. User lost access to old mailbox (ticket #123)"
          className="h-10"
        />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Change email"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function SetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(
    setUserPasswordAction.bind(null, userId),
    undefined,
  );
  return (
    <form
      action={action}
      onSubmit={submitKeepingValues(action)}
      className="space-y-3"
      autoComplete="off"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="New password">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-10"
          />
        </Field>
        <Field label="Confirm">
          <Input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-10"
          />
        </Field>
      </div>
      <Field label="Reason" hint="The user is emailed and signed out of every device.">
        <Input name="reason" required className="h-10" />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Set password"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function DecideVerificationForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    decideVerificationAction.bind(null, id),
    undefined,
  );
  if (state?.ok) return <Status state={state} />;
  return (
    <form
      action={action}
      onSubmit={submitKeepingValues(action)}
      className="flex flex-wrap items-end gap-2"
    >
      <Input
        name="reason"
        placeholder="Note (required to reject)"
        className="h-9 min-w-48 flex-1 text-sm"
        aria-label="Reason"
      />
      <Button type="submit" name="decision" value="approved" size="sm" disabled={pending}>
        Approve
      </Button>
      <Button
        type="submit"
        name="decision"
        value="rejected"
        size="sm"
        variant="danger"
        disabled={pending}
      >
        Reject
      </Button>
      <div className="w-full">
        <Status state={state} />
      </div>
    </form>
  );
}

/* ── Settings → Trust ─────────────────────────────────────────────────────── */

const LEVEL_OPTS = [0, 1, 2, 3];
const LIMIT_ROWS = [
  ["activeListings", "Live listings"],
  ["messagesPerDay", "Messages / day"],
  ["contactsPerDay", "Contact requests / day"],
  ["linksPerMessage", "Links per message"],
  ["activePromotions", "Active promotions"],
  ["actionsPerDay", "All actions / day"],
] as const;

function Check({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-brand-600 mt-0.5 size-4"
      />
      <span>
        {label}
        {hint ? <span className="text-muted block text-xs">{hint}</span> : null}
      </span>
    </label>
  );
}

export function TrustSettingsForm({ s }: { s: TrustSettings }) {
  const [state, action, pending] = useActionState(saveTrustSettingsAction, undefined);
  const ladder = [
    ...s.strikeLadder,
    ...Array(Math.max(0, 6 - s.strikeLadder.length)).fill(null),
  ].slice(0, 6);
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-8">
      <section className="space-y-4">
        <h3 className="font-semibold">Who can publish listings</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["consumer", "agent", "broker", "property_manager", "developer"] as const).map((r) => (
            <Field key={r} label={r === "consumer" ? "Private seller" : r.replace("_", " ")}>
              <Select
                name={`publish.${r}`}
                defaultValue={String(s.publishLevel[r])}
                className="h-10"
              >
                {LEVEL_OPTS.map((l) => (
                  <option key={l} value={l}>
                    Level {l}+
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
        <Check
          name="sellerListingsEnabled"
          label="Allow private sellers (consumer accounts) to list property"
          defaultChecked={s.sellerListingsEnabled}
        />
        <Field
          label="Review listings from accounts below"
          hint="Their listings wait in review before going live. 0 = never."
        >
          <Select
            name="reviewListingsBelowLevel"
            defaultValue={String(s.reviewListingsBelowLevel)}
            className="h-10 w-48"
          >
            {[0, 1, 2, 3, 4].map((l) => (
              <option key={l} value={l}>
                {l === 0 ? "No review" : l === 4 ? "Review everyone" : `Level ${l}`}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Verification</h3>
        <Check
          name="requireEmailToInteract"
          label="Require a verified email to message, contact agents or review"
          defaultChecked={s.requireEmailToInteract}
        />
        <Check
          name="requirePhoneForLevel1"
          label="Level 1 also requires a verified phone"
          hint="Changing this recalculates every account's level."
          defaultChecked={s.requirePhoneForLevel1}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Code valid (min)">
            <Input
              name="verificationCodeTtlMinutes"
              type="number"
              min={2}
              max={120}
              defaultValue={s.verificationCodeTtlMinutes}
              className="h-10"
            />
          </Field>
          <Field label="Code attempts">
            <Input
              name="verificationCodeMaxAttempts"
              type="number"
              min={1}
              max={20}
              defaultValue={s.verificationCodeMaxAttempts}
              className="h-10"
            />
          </Field>
          <Field label="Identity valid (days)" hint="Blank = never expires">
            <Input
              name="identityValidDays"
              type="number"
              min={1}
              defaultValue={s.identityValidDays ?? ""}
              className="h-10"
            />
          </Field>
          <Field label="License valid (days)" hint="Blank = never expires">
            <Input
              name="licenseValidDays"
              type="number"
              min={1}
              defaultValue={s.licenseValidDays ?? ""}
              className="h-10"
            />
          </Field>
          <Field label="Keep documents (days)">
            <Input
              name="documentRetentionDays"
              type="number"
              min={0}
              max={365}
              defaultValue={s.documentRetentionDays}
              className="h-10"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">New-account protection</h3>
        <Field
          label="Probation period (days)"
          hint="Accounts younger than this, or below level 1, use probation limits. Level 2+ accounts use trusted limits."
        >
          <Input
            name="probationDays"
            type="number"
            min={0}
            max={365}
            defaultValue={s.probationDays}
            className="h-10 w-32"
          />
        </Field>
        <div className="border-line overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-muted bg-paper/70 text-left text-xs">
                <th className="px-3 py-2 font-medium">Limit (blank = unlimited)</th>
                <th className="px-3 py-2 font-medium">Probation</th>
                <th className="px-3 py-2 font-medium">Standard</th>
                <th className="px-3 py-2 font-medium">Trusted</th>
              </tr>
            </thead>
            <tbody>
              {LIMIT_ROWS.map(([key, label]) => (
                <tr key={key} className="border-line border-t">
                  <td className="px-3 py-2">{label}</td>
                  {(["probation", "standard", "trusted"] as const).map((tier) => (
                    <td key={tier} className="px-3 py-2">
                      <Input
                        name={`${tier}.${key}`}
                        type="number"
                        min={0}
                        defaultValue={s[`${tier}Limits`][key] ?? ""}
                        placeholder="∞"
                        className="h-9 w-24"
                        aria-label={`${label} (${tier})`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Strikes</h3>
        <Check
          name="strikesEnabled"
          label="Apply the strike ladder automatically"
          defaultChecked={s.strikesEnabled}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
          <Field label="Strikes count for (days)">
            <Input
              name="strikeWindowDays"
              type="number"
              min={1}
              defaultValue={s.strikeWindowDays}
              className="h-10"
            />
          </Field>
          <Field label="Violation types" hint="Comma separated">
            <Input
              name="violationTypes"
              defaultValue={s.violationTypes.join(", ")}
              className="h-10"
            />
          </Field>
        </div>
        <div className="border-line overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-muted bg-paper/70 text-left text-xs">
                <th className="px-3 py-2 font-medium">At strike #</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Days</th>
                <th className="px-3 py-2 font-medium">Restrict (for “restrict”)</th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((step, i) => (
                <tr key={i} className="border-line border-t align-top">
                  <td className="px-3 py-2">
                    <Input
                      name={`ladder.${i}.strikes`}
                      type="number"
                      min={1}
                      defaultValue={step?.strikes ?? ""}
                      className="h-9 w-20"
                      aria-label={`Step ${i + 1} strikes`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      name={`ladder.${i}.action`}
                      defaultValue={step?.action ?? ""}
                      className="h-9 w-32"
                      aria-label={`Step ${i + 1} action`}
                    >
                      <option value="">—</option>
                      {STRIKE_ACTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      name={`ladder.${i}.days`}
                      type="number"
                      min={1}
                      defaultValue={step?.days ?? ""}
                      placeholder="∞"
                      className="h-9 w-20"
                      aria-label={`Step ${i + 1} days`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {RESTRICTABLE_FEATURES.map((f) => (
                        <label key={f} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            name={`ladder.${i}.features`}
                            value={f}
                            defaultChecked={step?.features.includes(f)}
                            className="accent-brand-600"
                          />
                          {f}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted text-xs">
          Leave a row&apos;s action empty to remove it. Past the last step, the last step applies
          again.
        </p>
      </section>

      <Status state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save trust settings"}
      </Button>
    </form>
  );
}
