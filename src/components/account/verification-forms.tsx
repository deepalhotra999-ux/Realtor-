"use client";

import { useActionState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import {
  confirmCodeAction,
  requestCodeAction,
  submitDocumentCheckAction,
  type VerifyState,
} from "@/server/actions/verification";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { submitKeepingValues } from "@/components/ui/form-submit";

function Msg({ state }: { state: VerifyState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p className="bg-clay-50 text-clay-600 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <TriangleAlert className="size-4 shrink-0" /> {state.error}
      </p>
    );
  return state.message ? (
    <p className="bg-brand-50 text-brand-700 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <CheckCircle2 className="size-4 shrink-0" /> {state.message}
    </p>
  ) : null;
}

/** Send a code, then enter it. Used for both email and phone. */
export function CodeVerifier({
  kind,
  target,
  pending,
}: {
  kind: "email" | "phone";
  target?: string | null;
  pending: boolean;
}) {
  const [sent, send, sending] = useActionState(requestCodeAction.bind(null, kind), undefined);
  const [confirmed, confirm, confirming] = useActionState(
    confirmCodeAction.bind(null, kind),
    undefined,
  );
  const awaitingCode = pending || sent?.ok;
  return (
    <div className="space-y-3">
      <form
        action={send}
        onSubmit={submitKeepingValues(send)}
        className="flex flex-wrap items-end gap-2"
      >
        {kind === "phone" ? (
          <Field label="Mobile number" className="min-w-52 flex-1">
            <Input
              name="phone"
              type="tel"
              required
              defaultValue={target ?? ""}
              placeholder="+1 555 010 0199"
              className="h-10"
            />
          </Field>
        ) : (
          <p className="text-muted flex-1 text-sm">
            We&apos;ll send a 6-digit code to <strong className="text-ink">{target}</strong>.
          </p>
        )}
        <Button
          type="submit"
          size="sm"
          variant={awaitingCode ? "secondary" : "primary"}
          disabled={sending}
        >
          {sending ? "Sending…" : awaitingCode ? "Send a new code" : "Send code"}
        </Button>
      </form>
      {sent?.devCode ? (
        <p className="bg-gold-100 text-gold-700 rounded-lg px-3 py-2 text-xs">
          Development mode: messages go to the local outbox, so here is your code:{" "}
          <strong className="font-mono text-sm">{sent.devCode}</strong>
        </p>
      ) : null}
      <Msg state={sent?.error ? sent : undefined} />
      {awaitingCode ? (
        <form
          action={confirm}
          onSubmit={submitKeepingValues(confirm)}
          className="flex flex-wrap items-end gap-2"
        >
          <Field label="Code" className="w-40">
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              className="h-10 font-mono tracking-widest"
            />
          </Field>
          <Button type="submit" size="sm" disabled={confirming}>
            {confirming ? "Checking…" : "Verify"}
          </Button>
        </form>
      ) : null}
      <Msg state={confirmed} />
    </div>
  );
}

export function IdentityForm() {
  const [state, action, pending] = useActionState(
    submitDocumentCheckAction.bind(null, "identity"),
    undefined,
  );
  if (state?.ok) return <Msg state={state} />;
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Full legal name">
          <Input name="legalName" required autoComplete="name" className="h-10" />
        </Field>
        <Field label="Document">
          <Select name="documentType" defaultValue="driver_license" className="h-10">
            <option value="driver_license">Driver&apos;s license</option>
            <option value="passport">Passport</option>
            <option value="state_id">State ID</option>
            <option value="other">Other government ID</option>
          </Select>
        </Field>
      </div>
      <Field label="Issuing country">
        <Input name="documentCountry" defaultValue="United States" required className="h-10" />
      </Field>
      <DocumentInput />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Submitting…" : "Submit for review"}
      </Button>
      <Msg state={state} />
    </form>
  );
}

export function LicenseForm({
  defaults,
}: {
  defaults: {
    licenseNumber?: string | null;
    licenseState?: string | null;
    brokerage?: string | null;
  };
}) {
  const [state, action, pending] = useActionState(
    submitDocumentCheckAction.bind(null, "license"),
    undefined,
  );
  if (state?.ok) return <Msg state={state} />;
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
        <Field label="License number">
          <Input
            name="licenseNumber"
            required
            defaultValue={defaults.licenseNumber ?? ""}
            className="h-10"
          />
        </Field>
        <Field label="State">
          <Input
            name="licenseState"
            required
            maxLength={2}
            defaultValue={defaults.licenseState ?? ""}
            className="h-10"
          />
        </Field>
      </div>
      <Field label="Brokerage (optional)">
        <Input name="brokerageName" defaultValue={defaults.brokerage ?? ""} className="h-10" />
      </Field>
      <DocumentInput label="License certificate or state lookup screenshot" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Submitting…" : "Submit for review"}
      </Button>
      <Msg state={state} />
    </form>
  );
}

function DocumentInput({ label = "Photo or scan of the document" }: { label?: string }) {
  return (
    <Field
      label={label}
      hint="JPEG, PNG, WebP or PDF, up to 8 MB. Only reviewers can see it, and it's deleted after review."
    >
      <input
        type="file"
        name="documents"
        required
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="file:border-line file:bg-surface text-muted block text-sm file:mr-3 file:rounded-full file:border file:px-3 file:py-1.5 file:text-sm"
      />
    </Field>
  );
}
