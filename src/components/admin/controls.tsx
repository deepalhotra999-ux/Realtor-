"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Switch bound to a server action. Optimistic, keyboard accessible. */
export function Toggle({
  checked,
  action,
  label,
  disabled,
}: {
  checked: boolean;
  action: (next: boolean) => Promise<unknown>;
  label: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(checked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          setValue(!value);
          await action(!value);
        })
      }
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60",
        value ? "bg-brand-600" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition",
          value ? "translate-x-5.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Small button that runs a server action with a pending state and optional confirm. */
export function ActionButton({
  action,
  children,
  confirm,
  tone = "default",
  className,
}: {
  action: () => Promise<unknown>;
  children: ReactNode;
  confirm?: string;
  tone?: "default" | "danger" | "primary";
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          await action();
        });
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition disabled:opacity-50",
        tone === "danger"
          ? "border-clay-100 text-clay-600 hover:bg-clay-50"
          : tone === "primary"
            ? "border-brand-600 bg-brand-600 hover:bg-brand-700 text-white"
            : "border-line bg-surface text-ink hover:bg-paper",
        className,
      )}
    >
      {pending ? "…" : children}
    </button>
  );
}

/** Select that submits a server action on change. */
export function ActionSelect({
  value,
  options,
  action,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  action: (v: string) => Promise<unknown>;
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={label}
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          await action(v);
        });
      }}
      className="border-line bg-surface h-8 rounded-lg border px-2 text-xs disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
