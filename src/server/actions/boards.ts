"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import {
  boardComments,
  boardItems,
  boardMembers,
  boards,
  boardVotes,
  listings,
} from "@/server/db/schema";
import { getCurrentUser, requireUser, type SessionUser } from "@/server/auth/session";
import { boardByInvite, boardRole } from "@/server/boards";
import { notify } from "@/server/notify";

export type BoardFormState = { ok?: boolean; error?: string; message?: string } | undefined;

const uuid = z.string().uuid();
const inviteCode = () => randomBytes(9).toString("base64url");

async function requireEditor(user: SessionUser, boardId: string) {
  const role = await boardRole(user.id, uuid.parse(boardId));
  if (role !== "owner" && role !== "editor") throw new Error("You can't edit this board.");
  return role;
}

async function itemBoard(itemId: string) {
  const [row] = await getDb()
    .select({ boardId: boardItems.boardId, listingId: boardItems.listingId })
    .from(boardItems)
    .where(eq(boardItems.id, uuid.parse(itemId)))
    .limit(1);
  if (!row) throw new Error("Item not found.");
  return row;
}

/** Tell the other members; failures never break the action. */
async function notifyMembers(boardId: string, actor: SessionUser, title: string, body: string) {
  const others = await getDb()
    .select({ userId: boardMembers.userId })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), ne(boardMembers.userId, actor.id)));
  await Promise.all(
    others.map((m) =>
      notify(
        m.userId,
        { type: "board", title, body, link: `/boards/${boardId}` },
        { email: true },
      ).catch(() => {}),
    ),
  );
}

async function touch(boardId: string) {
  await getDb().update(boards).set({ updatedAt: new Date() }).where(eq(boards.id, boardId));
}

export async function createBoardAction(
  _prev: BoardFormState,
  form: FormData,
): Promise<BoardFormState> {
  const user = await requireUser("/boards");
  const name = z.string().trim().min(1, "Name your board.").max(80).safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const description =
    String(form.get("description") ?? "")
      .trim()
      .slice(0, 300) || null;
  const db = getDb();
  const [b] = await db
    .insert(boards)
    .values({ name: name.data, description, ownerId: user.id, inviteCode: inviteCode() })
    .returning({ id: boards.id });
  await db.insert(boardMembers).values({ boardId: b.id, userId: user.id, role: "owner" });
  const listingId = form.get("listingId");
  if (typeof listingId === "string" && uuid.safeParse(listingId).success)
    await db.insert(boardItems).values({ boardId: b.id, listingId, addedById: user.id });
  revalidatePath("/boards");
  if (form.get("stay") === "1") return { ok: true, message: `Saved to “${name.data}”.` };
  redirect(`/boards/${b.id}`);
}

export async function toggleBoardItemAction(
  boardId: string,
  listingId: string,
): Promise<{ added: boolean } | { requiresAuth: true }> {
  const user = await getCurrentUser();
  if (!user) return { requiresAuth: true };
  await requireEditor(user, boardId);
  const db = getDb();
  const removed = await db
    .delete(boardItems)
    .where(and(eq(boardItems.boardId, boardId), eq(boardItems.listingId, uuid.parse(listingId))))
    .returning({ id: boardItems.id });
  if (removed.length) {
    revalidatePath(`/boards/${boardId}`);
    return { added: false };
  }
  await db
    .insert(boardItems)
    .values({ boardId, listingId, addedById: user.id })
    .onConflictDoNothing();
  await touch(boardId);
  const [l] = await db
    .select({ title: listings.title })
    .from(listings)
    .where(eq(listings.id, listingId));
  const [b] = await db.select({ name: boards.name }).from(boards).where(eq(boards.id, boardId));
  await notifyMembers(
    boardId,
    user,
    `${user.name} added a home to “${b.name}”`,
    l?.title ?? "A new home",
  );
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/boards");
  return { added: true };
}

export async function removeBoardItemAction(itemId: string) {
  const user = await requireUser("/boards");
  const { boardId } = await itemBoard(itemId);
  await requireEditor(user, boardId);
  await getDb().delete(boardItems).where(eq(boardItems.id, itemId));
  revalidatePath(`/boards/${boardId}`);
}

export async function voteBoardItemAction(itemId: string, value: number) {
  const user = await requireUser("/boards");
  const v = z.union([z.literal(-1), z.literal(0), z.literal(1)]).parse(value);
  const { boardId } = await itemBoard(itemId);
  if (!(await boardRole(user.id, boardId))) throw new Error("Not a member.");
  const db = getDb();
  if (v === 0)
    await db
      .delete(boardVotes)
      .where(and(eq(boardVotes.itemId, itemId), eq(boardVotes.userId, user.id)));
  else
    await db
      .insert(boardVotes)
      .values({ itemId, userId: user.id, value: v })
      .onConflictDoUpdate({ target: [boardVotes.itemId, boardVotes.userId], set: { value: v } });
  revalidatePath(`/boards/${boardId}`);
}

export async function commentBoardItemAction(
  itemId: string,
  _prev: BoardFormState,
  form: FormData,
): Promise<BoardFormState> {
  const user = await requireUser("/boards");
  const body = z.string().trim().min(1).max(1000).safeParse(form.get("body"));
  if (!body.success) return { error: "Write a comment." };
  const { boardId, listingId } = await itemBoard(itemId);
  if (!(await boardRole(user.id, boardId))) return { error: "Not a member of this board." };
  const db = getDb();
  await db.insert(boardComments).values({ itemId, authorId: user.id, body: body.data });
  await touch(boardId);
  const [l] = await db
    .select({ title: listings.title })
    .from(listings)
    .where(eq(listings.id, listingId));
  await notifyMembers(
    boardId,
    user,
    `${user.name} commented on ${l?.title ?? "a home"}`,
    body.data.slice(0, 280),
  );
  revalidatePath(`/boards/${boardId}`);
  return { ok: true };
}

export async function joinBoardAction(code: string) {
  const user = await requireUser(`/boards/join/${code}`);
  const board = await boardByInvite(z.string().min(6).max(40).parse(code));
  if (!board) redirect("/boards?invite=invalid");
  await getDb()
    .insert(boardMembers)
    .values({ boardId: board.id, userId: user.id, role: "editor" })
    .onConflictDoNothing();
  await notifyMembers(
    board.id,
    user,
    `${user.name} joined “${board.name}”`,
    "Say hi on the board.",
  );
  revalidatePath("/boards");
  redirect(`/boards/${board.id}`);
}

export async function resetInviteAction(boardId: string) {
  const user = await requireUser("/boards");
  if ((await boardRole(user.id, uuid.parse(boardId))) !== "owner") throw new Error("Owners only.");
  await getDb().update(boards).set({ inviteCode: inviteCode() }).where(eq(boards.id, boardId));
  revalidatePath(`/boards/${boardId}`);
}

export async function setMemberRoleAction(boardId: string, memberId: string, role: string) {
  const user = await requireUser("/boards");
  if ((await boardRole(user.id, uuid.parse(boardId))) !== "owner") throw new Error("Owners only.");
  const r = z.enum(["editor", "viewer", "remove"]).parse(role);
  const id = uuid.parse(memberId);
  if (id === user.id) throw new Error("You can't change your own role.");
  const where = and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, id));
  if (r === "remove") await getDb().delete(boardMembers).where(where);
  else await getDb().update(boardMembers).set({ role: r }).where(where);
  revalidatePath(`/boards/${boardId}`);
}

export async function leaveBoardAction(boardId: string) {
  const user = await requireUser("/boards");
  const role = await boardRole(user.id, uuid.parse(boardId));
  const db = getDb();
  if (role === "owner") {
    // Owners delete the board rather than orphaning it.
    await db.delete(boards).where(eq(boards.id, boardId));
  } else {
    await db
      .delete(boardMembers)
      .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, user.id)));
  }
  revalidatePath("/boards");
  redirect("/boards");
}
