"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCompare } from "./compare-store";

/** Keeps /compare?ids= in sync with the locally stored compare list. */
export function CompareSync({ urlIds }: { urlIds: string[] }) {
  const { ids } = useCompare();
  const router = useRouter();
  const key = ids.join(",");
  useEffect(() => {
    if (key !== urlIds.join(",") && (ids.length > 0 || urlIds.length > 0)) {
      router.replace(key ? `/compare?ids=${key}` : "/compare");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export function CompareRemove({ id }: { id: string }) {
  const { remove, has, toggle } = useCompare();
  return (
    <button
      type="button"
      onClick={() => (has(id) ? remove(id) : toggle(id))}
      aria-label="Remove from comparison"
      className="absolute top-2 right-2 z-20 inline-flex size-8 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white"
    >
      <X className="size-4" />
    </button>
  );
}
