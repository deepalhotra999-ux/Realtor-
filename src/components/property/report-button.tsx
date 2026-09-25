"use client";

import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { submitReportAction, type FormState } from "@/server/actions/marketplace";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";

import { submitKeepingValues } from "@/components/ui/form-submit";
export function ReportButton({
  targetType,
  targetId,
  label = "Report listing",
}: {
  targetType: "listing" | "review" | "user";
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitReportAction,
    undefined,
  );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted hover:text-ink inline-flex items-center gap-1.5 text-xs"
      >
        <Flag className="size-3.5" /> {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={label}>
        {state?.ok ? (
          <p className="text-ink-2 text-sm">{state.message}</p>
        ) : (
          <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-4">
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <Select name="reason" defaultValue="inaccurate" aria-label="Reason">
              <option value="inaccurate">Inaccurate information</option>
              <option value="fraud">Suspected scam or fraud</option>
              <option value="discrimination">Discriminatory content</option>
              <option value="offensive">Offensive content</option>
              <option value="spam">Spam</option>
              <option value="other">Something else</option>
            </Select>
            <Textarea
              name="details"
              placeholder="Anything that helps us review (optional)"
              rows={3}
              aria-label="Details"
            />
            {state?.error ? <p className="text-clay-600 text-sm">{state.error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Submit report"}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
