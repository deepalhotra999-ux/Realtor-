import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { getBoard } from "@/server/boards";
import {
  leaveBoardAction,
  removeBoardItemAction,
  resetInviteAction,
  setMemberRoleAction,
} from "@/server/actions/boards";
import { ActionButton, ActionSelect } from "@/components/admin/controls";
import { CommentForm, InviteLink, VoteButtons } from "@/components/boards/board-controls";
import { ListingCard } from "@/components/listing/listing-card";
import { Avatar, Card, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { getEnv } from "@/lib/env";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage(props: PageProps<"/boards/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/boards/${id}`);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const data = await getBoard(user.id, id);
  if (!data) notFound();
  const { board, role, members, items } = data;
  const canEdit = role === "owner" || role === "editor";
  const inviteUrl = new URL(`/boards/join/${board.inviteCode}`, getEnv().APP_URL).toString();
  // Most-loved first, so the shortlist floats to the top.
  const ranked = [...items].sort(
    (a, b) => b.loves.length - b.passes.length - (a.loves.length - a.passes.length),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-2 text-sm">
        <Link href="/boards" className="text-muted hover:text-ink">
          ← Boards
        </Link>
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">{board.name}</h1>
          {board.description ? <p className="text-muted mt-2">{board.description}</p> : null}
        </div>
        <div className="flex -space-x-2">
          {members.map((m) => (
            <span
              key={m.userId}
              title={`${m.name} (${m.role})`}
              className="ring-paper rounded-full ring-2"
            >
              <Avatar name={m.name} src={m.avatarUrl} size={36} />
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {ranked.length === 0 ? (
            <EmptyState
              title="No homes on this board yet"
              action={<ButtonLink href="/search">Browse homes</ButtonLink>}
            >
              Use the “Board” button on any home to add it here.
            </EmptyState>
          ) : (
            <ul className="space-y-6">
              {ranked.map((item) => (
                <li key={item.id}>
                  <Card className="grid gap-4 p-4 md:grid-cols-[280px_1fr]">
                    <ListingCard listing={item.listing} />
                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-muted text-xs">
                          Added by {item.addedBy ?? "someone"} {relativeTime(item.createdAt)}
                        </p>
                        {canEdit ? (
                          <ActionButton
                            tone="danger"
                            confirm="Remove this home from the board?"
                            action={removeBoardItemAction.bind(null, item.id)}
                            className="px-2"
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">Remove</span>
                          </ActionButton>
                        ) : null}
                      </div>
                      <div className="mt-2">
                        <VoteButtons
                          itemId={item.id}
                          myVote={item.myVote}
                          loves={item.loves}
                          passes={item.passes}
                        />
                      </div>
                      <ul className="mt-4 flex-1 space-y-3">
                        {item.comments.map((c) => (
                          <li key={c.id} className="flex gap-2.5">
                            <Avatar name={c.author} size={28} />
                            <div className="min-w-0">
                              <p className="text-xs">
                                <span className="font-medium">
                                  {c.authorId === user.id ? "You" : c.author}
                                </span>{" "}
                                <span className="text-muted">{relativeTime(c.createdAt)}</span>
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3">
                        <CommentForm itemId={item.id} />
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-5">
          {canEdit ? (
            <Card className="p-5">
              <p className="font-semibold">Invite people</p>
              <p className="text-muted mt-1 mb-3 text-xs">
                Anyone with this link can join as an editor.
              </p>
              <InviteLink url={inviteUrl} />
              {role === "owner" ? (
                <div className="mt-3">
                  <ActionButton
                    confirm="Create a new link? The old one stops working."
                    action={resetInviteAction.bind(null, board.id)}
                  >
                    Reset link
                  </ActionButton>
                </div>
              ) : null}
            </Card>
          ) : null}
          <Card className="p-5">
            <p className="mb-3 font-semibold">Members</p>
            <ul className="space-y-2.5">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={m.name} src={m.avatarUrl} size={28} />
                    <span className="truncate">{m.userId === user.id ? "You" : m.name}</span>
                  </span>
                  {role === "owner" && m.role !== "owner" ? (
                    <ActionSelect
                      label={`Role for ${m.name}`}
                      value={m.role}
                      options={[
                        { value: "editor", label: "Editor" },
                        { value: "viewer", label: "Viewer" },
                        { value: "remove", label: "Remove" },
                      ]}
                      action={setMemberRoleAction.bind(null, board.id, m.userId)}
                    />
                  ) : (
                    <span className="text-muted text-xs capitalize">{m.role}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-line mt-4 border-t pt-4">
              <ActionButton
                tone="danger"
                confirm={
                  role === "owner"
                    ? "Delete this board for everyone? This can't be undone."
                    : "Leave this board?"
                }
                action={leaveBoardAction.bind(null, board.id)}
              >
                {role === "owner" ? "Delete board" : "Leave board"}
              </ActionButton>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
