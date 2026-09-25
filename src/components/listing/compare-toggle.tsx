"use client";

import { GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompare } from "./compare-store";

export function CompareToggle({
  listingId,
  variant = "icon",
}: {
  listingId: string;
  variant?: "icon" | "button";
}) {
  const { has, toggle } = useCompare();
  const active = has(listingId);
  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={() => toggle(listingId)}
        aria-pressed={active}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
          active
            ? "border-brand-500 bg-brand-50 text-brand-700"
            : "border-line bg-surface text-ink hover:border-line-strong",
        )}
      >
        <GitCompareArrows className="size-4" />
        {active ? "In comparison" : "Compare"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(listingId);
      }}
      aria-pressed={active}
      aria-label={active ? "Remove from comparison" : "Add to comparison"}
      title={active ? "Remove from comparison" : "Compare"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full shadow-sm backdrop-blur transition",
        active ? "bg-brand-600 text-white" : "text-ink bg-white/90 hover:bg-white",
      )}
    >
      <GitCompareArrows className="size-4" />
    </button>
  );
}
