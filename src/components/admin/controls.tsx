"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
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
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled || pending}
        title={error ?? undefined}
        onClick={() =>
          start(async () => {
            setValue(!value);
            // On a refusal the optimistic value falls back to `checked` by itself.
            setError(errorOf(await action(!value)));
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
      {error ? (
        <span role="alert" className="text-clay-600 block max-w-56 text-[11px] leading-snug">
          {error}
        </span>
      ) : null}
    </>
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
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        title={error ?? undefined}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            setError(errorOf(await action()));
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
      {error ? (
        <span role="alert" className="text-clay-600 block max-w-56 text-[11px] leading-snug">
          {error}
        </span>
      ) : null}
    </>
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
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <select
        aria-label={label}
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          const el = e.currentTarget;
          const v = el.value;
          start(async () => {
            const err = errorOf(await action(v));
            setError(err);
            // A refused change must not look applied.
            if (err) el.value = value;
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
      {error ? (
        <span className="text-clay-600 max-w-56 text-[11px] leading-snug">{error}</span>
      ) : null}
    </span>
  );
}

/** Actions may return `{ error }` instead of throwing; surface it. */
function errorOf(res: unknown): string | null {
  return res && typeof res === "object" && "error" in res && typeof res.error === "string"
    ? res.error
    : null;
}
