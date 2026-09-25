"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { Check, Copy, Heart, LayoutGrid, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  commentBoardItemAction,
  createBoardAction,
  toggleBoardItemAction,
  voteBoardItemAction,
} from "@/server/actions/boards";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function CreateBoardForm({ listingId }: { listingId?: string }) {
  const [state, action, pending] = useActionState(createBoardAction, undefined);
  const router = useRouter();
  // Created from a listing page: re-render it so the new board appears in the list.
  useEffect(() => {
    if (state?.ok && listingId) router.refresh();
  }, [state, listingId, router]);
  if (state?.ok) return <p className="text-brand-700 text-sm">{state.message}</p>;
  return (
    <form action={action} className="space-y-2">
      {listingId ? (
        <>
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="stay" value="1" />
        </>
      ) : null}
      <Input
        name="name"
        required
        maxLength={80}
        placeholder="e.g. Our first home"
        className="h-10"
        aria-label="Board name"
      />
      {!listingId ? (
        <Input
          name="description"
          maxLength={300}
          placeholder="What are you looking for? (optional)"
          className="h-10"
          aria-label="Description"
        />
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        <Plus className="size-4" /> {pending ? "Creating…" : "Create board"}
      </Button>
      {state?.error ? <p className="text-clay-600 text-xs">{state.error}</p> : null}
    </form>
  );
}

/** Property page control: add/remove the listing on any board you can edit. */
export function SaveToBoard({
  listingId,
  boards,
  signedIn,
}: {
  listingId: string;
  boards: { id: string; name: string; has: boolean }[];
  signedIn: boolean;
}) {
  // Server props stay the source of truth (they refresh after a board is
  // created); local toggles are layered on top until the next refresh.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const items = boards.map((b) => ({ ...b, has: toggled[b.id] ?? b.has }));
  const [pending, start] = useTransition();
  const pathname = usePathname();
  if (!signedIn)
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="border-line bg-surface hover:border-line-strong inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition"
      >
        <LayoutGrid className="size-4" /> Board
      </Link>
    );
  return (
    <Popover
      align="right"
      label={
        <>
          <LayoutGrid className="size-4" /> Board
        </>
      }
    >
      {() => (
        <div className="w-64 max-w-full space-y-3">
          <p className="text-sm font-semibold">Save to a shared board</p>
          {items.length ? (
            <ul className="space-y-1">
              {items.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await toggleBoardItemAction(b.id, listingId);
                        if ("added" in res) setToggled((t) => ({ ...t, [b.id]: res.added }));
                      })
                    }
                    className="hover:bg-paper flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                  >
                    <span className="truncate">{b.name}</span>
                    {b.has ? (
                      <Check className="text-brand-600 size-4" />
                    ) : (
                      <Plus className="text-muted size-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-xs">
              Boards let you shortlist homes with a partner, family or your agent.
            </p>
          )}
          <div className="border-line border-t pt-3">
            <CreateBoardForm listingId={listingId} />
          </div>
        </div>
      )}
    </Popover>
  );
}

export function VoteButtons({
  itemId,
  myVote,
  loves,
  passes,
  disabled,
}: {
  itemId: string;
  myVote: number;
  loves: string[];
  passes: string[];
  disabled?: boolean;
}) {
  const [vote, setVote] = useOptimistic(myVote);
  const [, start] = useTransition();
  const cast = (v: number) =>
    start(async () => {
      const next = vote === v ? 0 : v;
      setVote(next);
      await voteBoardItemAction(itemId, next);
    });
  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition disabled:opacity-50";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => cast(1)}
        aria-pressed={vote === 1}
        title={loves.length ? `Loved by ${loves.join(", ")}` : "Love it"}
        className={cn(
          btn,
          vote === 1
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-line bg-surface hover:bg-paper",
        )}
      >
        <ThumbsUp className="size-3.5" /> {loves.length}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => cast(-1)}
        aria-pressed={vote === -1}
        title={passes.length ? `Passed by ${passes.join(", ")}` : "Pass"}
        className={cn(
          btn,
          vote === -1
            ? "border-clay-600 bg-clay-600 text-white"
            : "border-line bg-surface hover:bg-paper",
        )}
      >
        <ThumbsDown className="size-3.5" /> {passes.length}
      </button>
      {loves.length ? (
        <span className="text-muted flex items-center gap-1 truncate text-xs">
          <Heart className="size-3" /> {loves.join(", ")}
        </span>
      ) : null}
    </div>
  );
}

export function CommentForm({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(
    commentBoardItemAction.bind(null, itemId),
    undefined,
  );
  return (
    <form action={action} className="flex items-start gap-2">
      <Textarea
        name="body"
        rows={1}
        required
        maxLength={1000}
        placeholder="Add a comment…"
        className="min-h-9 flex-1 py-2 text-sm"
        aria-label="Comment"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Post
      </Button>
      {state?.error ? <p className="text-clay-600 text-xs">{state.error}</p> : null}
    </form>
  );
}

export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={url}
        className="h-9 text-xs"
        aria-label="Invite link"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard unavailable — the field is selectable */
          }
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
