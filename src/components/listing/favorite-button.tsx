"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/server/actions/marketplace";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  listingId,
  initial,
  variant = "icon",
  className,
}: {
  listingId: string;
  initial: boolean;
  variant?: "icon" | "button";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [favorited, setFavorited] = useOptimistic(initial);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      setFavorited(!favorited);
      const res = await toggleFavoriteAction(listingId);
      if ("requiresAuth" in res) router.push(`/login?next=${encodeURIComponent(pathname)}`);
      else router.refresh();
    });
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={favorited}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
          favorited
            ? "border-clay-500/40 bg-clay-50 text-clay-600"
            : "border-line bg-surface text-ink hover:border-line-strong",
          className,
        )}
      >
        <Heart className={cn("size-4", favorited && "fill-current")} />
        {favorited ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from saved homes" : "Save home"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white",
        className,
      )}
    >
      <Heart
        className={cn(
          "size-[18px] transition",
          favorited ? "fill-clay-500 text-clay-500" : "text-ink",
        )}
      />
    </button>
  );
}
