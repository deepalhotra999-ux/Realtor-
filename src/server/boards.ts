import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  boardComments,
  boardItems,
  boardMembers,
  boards,
  boardVotes,
  users,
} from "@/server/db/schema";
import { getSearch } from "@/providers";

export type BoardRole = "owner" | "editor" | "viewer";

export async function boardRole(userId: string, boardId: string): Promise<BoardRole | null> {
  const [m] = await getDb()
    .select({ role: boardMembers.role })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
    .limit(1);
  return m?.role ?? null;
}

export async function listMyBoards(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      updatedAt: boards.updatedAt,
      role: boardMembers.role,
      items: sql<number>`(select count(*)::int from board_items bi where bi.board_id = ${boards.id})`,
      members: sql<number>`(select count(*)::int from board_members bm where bm.board_id = ${boards.id})`,
      cover: sql<string | null>`(
        select pm.url from board_items bi
        join listings l on l.id = bi.listing_id
        join property_media pm on pm.property_id = l.property_id
        where bi.board_id = ${boards.id}
        order by bi.created_at desc, pm.sort_order limit 1)`,
    })
    .from(boardMembers)
    .innerJoin(boards, eq(boards.id, boardMembers.boardId))
    .where(eq(boardMembers.userId, userId))
    .orderBy(desc(boards.updatedAt));
  return rows;
}

/** Boards the user can add homes to, with whether a listing is already on each. */
export async function boardsForListing(userId: string, listingId: string) {
  const rows = await getDb()
    .select({
      id: boards.id,
      name: boards.name,
      has: sql<boolean>`exists (select 1 from board_items bi where bi.board_id = ${boards.id} and bi.listing_id = ${listingId})`,
    })
    .from(boardMembers)
    .innerJoin(boards, eq(boards.id, boardMembers.boardId))
    .where(and(eq(boardMembers.userId, userId), inArray(boardMembers.role, ["owner", "editor"])))
    .orderBy(desc(boards.updatedAt));
  return rows;
}

export async function getBoard(userId: string, boardId: string) {
  const role = await boardRole(userId, boardId);
  if (!role) return null;
  const db = getDb();
  const [[board], members, items] = await Promise.all([
    db.select().from(boards).where(eq(boards.id, boardId)),
    db
      .select({
        userId: boardMembers.userId,
        role: boardMembers.role,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(boardMembers)
      .innerJoin(users, eq(users.id, boardMembers.userId))
      .where(eq(boardMembers.boardId, boardId))
      .orderBy(asc(boardMembers.joinedAt)),
    db
      .select({
        id: boardItems.id,
        listingId: boardItems.listingId,
        createdAt: boardItems.createdAt,
        addedBy: users.name,
      })
      .from(boardItems)
      .leftJoin(users, eq(users.id, boardItems.addedById))
      .where(eq(boardItems.boardId, boardId))
      .orderBy(desc(boardItems.createdAt)),
  ]);
  const itemIds = items.map((i) => i.id);
  const [listings, votes, comments] = await Promise.all([
    getSearch().byIds(items.map((i) => i.listingId)),
    itemIds.length
      ? db
          .select({ itemId: boardVotes.itemId, userId: boardVotes.userId, value: boardVotes.value })
          .from(boardVotes)
          .where(inArray(boardVotes.itemId, itemIds))
      : [],
    itemIds.length
      ? db
          .select({
            id: boardComments.id,
            itemId: boardComments.itemId,
            body: boardComments.body,
            createdAt: boardComments.createdAt,
            authorId: boardComments.authorId,
            author: users.name,
          })
          .from(boardComments)
          .innerJoin(users, eq(users.id, boardComments.authorId))
          .where(inArray(boardComments.itemId, itemIds))
          .orderBy(asc(boardComments.createdAt))
      : [],
  ]);
  const byListing = new Map(listings.map((l) => [l.id, l]));
  const names = new Map(members.map((m) => [m.userId, m.name]));
  return {
    board,
    role,
    members,
    items: items
      .filter((i) => byListing.has(i.listingId))
      .map((i) => {
        const v = votes.filter((x) => x.itemId === i.id);
        return {
          ...i,
          listing: byListing.get(i.listingId)!,
          loves: v.filter((x) => x.value > 0).map((x) => names.get(x.userId) ?? "Someone"),
          passes: v.filter((x) => x.value < 0).map((x) => names.get(x.userId) ?? "Someone"),
          myVote: v.find((x) => x.userId === userId)?.value ?? 0,
          comments: comments.filter((c) => c.itemId === i.id),
        };
      }),
  };
}

export async function boardByInvite(code: string) {
  const [row] = await getDb()
    .select({
      id: boards.id,
      name: boards.name,
      owner: users.name,
      members: count(boardMembers.userId),
    })
    .from(boards)
    .innerJoin(users, eq(users.id, boards.ownerId))
    .leftJoin(boardMembers, eq(boardMembers.boardId, boards.id))
    .where(eq(boards.inviteCode, code))
    .groupBy(boards.id, boards.name, users.name)
    .limit(1);
  return row ?? null;
}
