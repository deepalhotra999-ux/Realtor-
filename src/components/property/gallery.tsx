"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Grid2x2, X } from "lucide-react";
import type { MediaItem } from "@/lib/listing-types";
import { cn } from "@/lib/utils";

export function Gallery({ media, title }: { media: MediaItem[]; title: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (d: number) => setIndex((i) => (i === null ? i : (i + d + media.length) % media.length)),
    [media.length],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, close, step]);

  if (!media.length) return <div className="bg-paper-2 aspect-[16/7] rounded-3xl" />;
  const tiles = media.slice(0, 5);

  return (
    <>
      <div className="relative grid h-[42vh] min-h-72 grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl sm:h-[52vh] lg:max-h-[560px]">
        {tiles.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setIndex(i)}
            className={cn(
              "group bg-paper-2 relative overflow-hidden",
              i === 0 ? "col-span-4 row-span-2 sm:col-span-2" : "hidden sm:block",
              tiles.length === 2 && i === 1 && "col-span-2 row-span-2",
              tiles.length === 3 && i > 0 && "col-span-2",
            )}
            aria-label={`Open photo ${i + 1} of ${media.length}`}
          >
            <img
              src={m.url}
              alt={m.alt || title}
              className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIndex(0)}
          className="shadow-card absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white"
        >
          <Grid2x2 className="size-4" /> {media.length} photos
        </button>
      </div>

      {index !== null ? (
        <div
          className="bg-ink/95 fixed inset-0 z-[70] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <div className="flex items-center justify-between px-5 py-4 text-white">
            <p className="tabular text-sm">
              {index + 1} / {media.length}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16">
            <img
              src={media[index].url}
              alt={media[index].alt || title}
              className="max-h-full max-w-full rounded-2xl object-contain"
            />
            {media.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className="absolute left-3 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-6"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className="absolute right-3 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-6"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            ) : null}
          </div>
          {media[index].caption ? (
            <p className="pb-6 text-center text-sm text-white/80">{media[index].caption}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
