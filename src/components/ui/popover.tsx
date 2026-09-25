"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal accessible popover: a pill trigger with a floating panel.
 *
 * The panel is portaled to document.body and positioned `fixed` under the
 * trigger. That keeps it reachable when the trigger lives inside a
 * horizontally-scrolling strip (the mobile filter bar, whose overflow would
 * otherwise clip an absolutely-positioned panel) or under an ancestor with
 * backdrop-blur (which can trap fixed-position descendants in some browsers).
 */
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef({ left: 0, top: 0, right: 0 });
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const close = () => setOpen(false);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      anchorRef.current = { left: r.left, top: r.bottom + 8, right: r.right };
      setPos(null); // re-measure once the panel renders
    }
    setOpen((o) => !o);
  };

  // Measure the rendered panel and clamp it inside the viewport.
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const w = panelRef.current.offsetWidth;
    const vw = window.innerWidth;
    const a = anchorRef.current;
    const raw = align === "right" ? a.right - w : a.left;
    setPos({ left: Math.max(8, Math.min(raw, vw - w - 8)), top: a.top });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // A fixed panel would detach from its trigger on page scroll — close it,
    // but ignore scrolls that happen inside the panel itself.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [open ]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition",
          active
            ? "border-ink bg-ink text-white"
            : "border-line bg-surface text-ink hover:border-line-strong",
        )}
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={cn(
              "animate-fade-up border-line bg-surface shadow-pop fixed z-[100] min-w-64 rounded-2xl border p-4",
              // Stay usable on narrow phones: cap size, scroll internally.
              "max-h-[70dvh] max-w-[calc(100vw-1rem)] overflow-y-auto",
              panelClassName,
            )}
            style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden", left: 0, top: 0 }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Segmented single-select control (Any / Studio+ / 1+ …). */
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
            "min-w-0 flex-1 px-3 py-2 text-sm whitespace-nowrap transition",
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
