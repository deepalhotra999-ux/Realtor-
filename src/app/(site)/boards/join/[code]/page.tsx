import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { boardByInvite, boardRole } from "@/server/boards";
import { joinBoardAction } from "@/server/actions/boards";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Join board", robots: { index: false } };

export default async function JoinBoardPage(props: PageProps<"/boards/join/[code]">) {
  const { code } = await props.params;
  const user = await requireUser(`/boards/join/${code}`);
  const board = code.length >= 6 && code.length <= 40 ? await boardByInvite(code) : null;
  if (!board)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Invite not found</h1>
        <p className="text-muted mt-3">This invite link is invalid or has been reset.</p>
        <ButtonLink href="/boards" className="mt-6">
          Your boards
        </ButtonLink>
      </div>
    );
  const already = await boardRole(user.id, board.id);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8 text-center">
        <div className="bg-brand-50 text-brand-600 mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl">
          <LayoutGrid className="size-5" />
        </div>
        <h1 className="font-display text-2xl">{board.name}</h1>
        <p className="text-muted mt-2 text-sm">
          {board.owner} invited you to a shared board with {board.members} member
          {board.members === 1 ? "" : "s"}.
        </p>
        {already ? (
          <ButtonLink href={`/boards/${board.id}`} className="mt-6">
            Open board
          </ButtonLink>
        ) : (
          <form action={joinBoardAction.bind(null, code)} className="mt-6">
            <Button type="submit">Join board</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
