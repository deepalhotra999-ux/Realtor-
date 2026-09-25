"use client";

import { useActionState, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  addLeadActivityAction,
  createLeadAction,
  draftFollowUpAction,
  emailLeadAction,
} from "@/server/actions/pro";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { submitKeepingValues } from "@/components/ui/form-submit";
import { StatusMessage } from "./listing-form";

export function ActivityForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(
    addLeadActivityAction.bind(null, leadId),
    undefined,
  );
  const [type, setType] = useState("note");
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 w-36"
          aria-label="Activity type"
        >
          <option value="note">Note</option>
          <option value="call">Call</option>
          <option value="email">Email (logged)</option>
          <option value="sms">Text</option>
          <option value="meeting">Meeting</option>
          <option value="task">Task</option>
        </Select>
        {type === "task" ? (
          <Input
            name="dueAt"
            type="datetime-local"
            className="h-9 w-56"
            aria-label="Due"
            required
          />
        ) : null}
      </div>
      <Textarea
        name="body"
        rows={3}
        required
        placeholder={type === "task" ? "What needs doing?" : "What happened?"}
        aria-label="Details"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : type === "task" ? "Add task" : "Log activity"}
        </Button>
        <StatusMessage state={state} />
      </div>
    </form>
  );
}

export function EmailLeadForm({
  leadId,
  email,
  defaultSubject,
}: {
  leadId: string;
  email: string;
  defaultSubject: string;
}) {
  const [state, action, pending] = useActionState(emailLeadAction.bind(null, leadId), undefined);
  const [body, setBody] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [drafting, start] = useTransition();
  if (state?.ok) return <StatusMessage state={state} />;
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <p className="text-muted text-xs">To: {email}</p>
      <Input name="subject" defaultValue={defaultSubject} className="h-10" aria-label="Subject" />
      <Textarea
        name="body"
        rows={7}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Message"
        required
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send email"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="soft"
          disabled={drafting}
          onClick={() =>
            start(async () => {
              const res = await draftFollowUpAction(leadId);
              if (res?.ok) {
                setBody(res.text);
                setNote(
                  res.provider === "rules"
                    ? "Drafted from this lead's details. Edit before sending."
                    : `Drafted by ${res.provider}. Review before sending.`,
                );
              } else setNote(res?.error ?? "Couldn't draft a message.");
            })
          }
        >
          <Sparkles className="size-4" /> {drafting ? "Drafting…" : "Draft with AI"}
        </Button>
      </div>
      {note ? <p className="text-muted text-xs">{note}</p> : null}
      <StatusMessage state={state} />
    </form>
  );
}

export function NewLeadForm() {
  const [state, action, pending] = useActionState(createLeadAction, undefined);
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Name">
          <Input name="name" required className="h-10" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" className="h-10" />
        </Field>
        <Field label="Phone">
          <Input name="phone" className="h-10" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Looking to">
          <Select name="intent" className="h-10" defaultValue="">
            <option value="">Not sure yet</option>
            <option value="sale">Buy</option>
            <option value="rent">Rent</option>
          </Select>
        </Field>
        <Field label="Budget up to ($)">
          <Input name="budgetMax" type="number" min={0} className="h-10" />
        </Field>
        <Field label="Source">
          <Select name="source" className="h-10" defaultValue="manual">
            <option value="manual">Added manually</option>
            <option value="referral">Referral</option>
          </Select>
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="message" rows={2} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add lead"}
        </Button>
        <StatusMessage state={state} />
      </div>
    </form>
  );
}
