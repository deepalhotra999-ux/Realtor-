import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, Users } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listMyBoards } from "@/server/boards";
import { CreateBoardForm } from "@/components/boards/board-controls";
import { Card, EmptyState } from "@/components/ui/misc";
import { relativeTime } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Shared boards" };

export default async function BoardsPage(props: PageProps<"/boards">) {
  const sp = (await props.searchParams) as SP;
  const user = await requireUser("/boards");
  const boards = await listMyBoards(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl">Shared boards</h1>
      <p className="text-muted mt-2 max-w-2xl">
        Shortlist homes together with a partner, family or your agent. Vote, comment and decide as a
        team.
      </p>
      {str(sp, "invite") === "invalid" ? (
        <p className="bg-clay-50 text-clay-600 mt-5 rounded-xl p-3 text-sm">
          That invite link is no longer valid. Ask the board owner for a new one.
        </p>
      ) : null}

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((b) => (
          <Link key={b.id} href={`/boards/${b.id}`} className="group">
            <Card className="group-hover:shadow-lift overflow-hidden transition">
              <div className="bg-paper-2 relative aspect-[16/9]">
                {b.cover ? (
                  <img src={b.cover} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <LayoutGrid className="text-subtle absolute inset-0 m-auto size-8" />
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold">{b.name}</p>
                {b.description ? (
                  <p className="text-muted mt-0.5 truncate text-sm">{b.description}</p>
                ) : null}
                <p className="text-muted mt-2 flex items-center gap-3 text-xs">
                  <span>
                    {b.items} home{b.items === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" /> {b.members}
                  </span>
                  <span>Updated {relativeTime(b.updatedAt)}</span>
                </p>
              </div>
            </Card>
          </Link>
        ))}
        <Card className="p-5">
          <p className="mb-3 font-semibold">New board</p>
          <CreateBoardForm />
        </Card>
      </div>
      {boards.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<LayoutGrid className="size-5" />} title="No boards yet">
            Create one above, or use the “Board” button on any home to start collecting.
          </EmptyState>
        </div>
      ) : null}
    </div>
  );
}
