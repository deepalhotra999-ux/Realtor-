"use client";

import { useActionState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import {
  deleteListingPhotoAction,
  moveListingPhotoAction,
  uploadListingPhotosAction,
} from "@/server/actions/pro";
import { ActionButton } from "@/components/admin/controls";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "./listing-form";

export function PhotoManager({
  listingId,
  photos,
}: {
  listingId: string;
  photos: { id: string; url: string; alt: string }[];
}) {
  const [state, action, pending] = useActionState(
    uploadListingPhotosAction.bind(null, listingId),
    undefined,
  );
  return (
    <div className="space-y-4">
      {photos.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="border-line overflow-hidden rounded-xl border">
              <div className="relative aspect-[4/3]">
                <img src={p.url} alt={p.alt} className="absolute inset-0 size-full object-cover" />
                {i === 0 ? (
                  <span className="bg-ink/80 absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white">
                    Cover
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-1">
                  <ActionButton
                    action={moveListingPhotoAction.bind(null, p.id, "up")}
                    className="px-2"
                  >
                    <ArrowUp className="size-3.5" />
                    <span className="sr-only">Move earlier</span>
                  </ActionButton>
                  <ActionButton
                    action={moveListingPhotoAction.bind(null, p.id, "down")}
                    className="px-2"
                  >
                    <ArrowDown className="size-3.5" />
                    <span className="sr-only">Move later</span>
                  </ActionButton>
                </div>
                <ActionButton
                  tone="danger"
                  confirm="Delete this photo?"
                  action={deleteListingPhotoAction.bind(null, p.id)}
                  className="px-2"
                >
                  <Trash2 className="size-3.5" />
                  <span className="sr-only">Delete photo</span>
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">
          No photos yet. Listings with photos get far more views.
        </p>
      )}
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="file:border-line file:bg-surface text-muted text-sm file:mr-3 file:rounded-full file:border file:px-3 file:py-1.5 file:text-sm"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <ImagePlus className="size-4" /> {pending ? "Uploading…" : "Upload"}
        </Button>
        <div className="w-full">
          <StatusMessage state={state} />
        </div>
      </form>
    </div>
  );
}
