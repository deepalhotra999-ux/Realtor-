"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Minimal accessible popover: a pill trigger with a floating panel. */
export function Popover({
  label,
  active = false,
  children,
  align = "left",
  panelClassName,
}: {
  label: ReactNode;
  active?: boolean;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition",
          active
            ? "border-ink bg-ink text-white"
            : "border-line bg-surface text-ink hover:border-line-strong",
        )}
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          className={cn(
            "animate-fade-up border-line bg-surface shadow-pop absolute top-full z-50 mt-2 min-w-64 rounded-2xl border p-4",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string | number | undefined>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="border-line flex overflow-hidden rounded-xl border">
      {options.map((o, i) => (
        <button
          key={String(o.value ?? "any")}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-3 py-2 text-sm transition",
            i > 0 && "border-line border-l",
            value === o.value
              ? "bg-brand-600 font-semibold text-white"
              : "bg-surface text-ink-2 hover:bg-paper",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
