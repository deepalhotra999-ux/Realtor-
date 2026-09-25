"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitCompareArrows, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { COMPARE_MAX, useCompare } from "./compare-store";

export function CompareTray() {
  const { ids, clear } = useCompare();
  const pathname = usePathname();
  if (ids.length === 0 || pathname.startsWith("/compare")) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="animate-fade-up border-line bg-surface shadow-pop flex items-center gap-3 rounded-full border py-2 pr-2 pl-4">
        <GitCompareArrows className="text-brand-600 size-4" />
        <span className="text-sm font-medium">
          {ids.length} of {COMPARE_MAX} homes selected
        </span>
        <Link href={`/compare?ids=${ids.join(",")}`} className={buttonClass("primary", "sm")}>
          Compare
        </Link>
        <button
          type="button"
          onClick={clear}
          aria-label="Clear comparison"
          className="text-muted hover:bg-paper inline-flex size-8 items-center justify-center rounded-full"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
