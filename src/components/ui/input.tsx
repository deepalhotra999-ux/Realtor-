import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-subtle shadow-[inset_0_1px_1px_rgb(0_0_0/0.02)] transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(fieldClass, "min-h-24 py-3 leading-relaxed", className)} {...props} />
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldClass,
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b756f%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] h-11 appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label className={cn("text-ink-2 mb-1.5 block text-sm font-medium", className)} {...props} />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-clay-600 mt-1.5 text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted mt-1.5 text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("text-ink-2 flex cursor-pointer items-center gap-2.5 text-sm", className)}>
      <input
        type="checkbox"
        className="border-line-strong accent-brand-600 size-4 rounded"
        {...props}
      />
      {label}
    </label>
  );
}
