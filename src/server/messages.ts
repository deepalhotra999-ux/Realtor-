import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  conversationParticipants,
  conversations,
  listings,
  messages,
  users,
} from "@/server/db/schema";

export async function listConversations(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: conversations.id,
      subject: conversations.subject,
      lastMessageAt: conversations.lastMessageAt,
      lastReadAt: conversationParticipants.lastReadAt,
      listingTitle: listings.title,
      listingSlug: listings.slug,
      lastBody: sql<
        string | null
      >`(select m.body from messages m where m.conversation_id = ${conversations.id} order by m.created_at desc limit 1)`,
    })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
    .leftJoin(listings, eq(listings.id, conversations.listingId))
    .where(eq(conversationParticipants.userId, userId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);
  if (!rows.length) return [];
  const others = await db
    .select({
      conversationId: conversationParticipants.conversationId,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(
      and(
        inArray(
          conversationParticipants.conversationId,
          rows.map((r) => r.id),
        ),
        ne(conversationParticipants.userId, userId),
      ),
    );
  return rows.map((r) => ({
    ...r,
    unread: !r.lastReadAt || r.lastReadAt < r.lastMessageAt,
    participants: others.filter((o) => o.conversationId === r.id),
  }));
}

/** Returns null unless the user participates in the conversation. */
export async function getConversation(userId: string, id: string) {
  const db = getDb();
  const [membership] = await db
    .select({ lastReadAt: conversationParticipants.lastReadAt })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, id),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  if (!membership) return null;
  const [[conv], thread, people] = await Promise.all([
    db
      .select({
        id: conversations.id,
        subject: conversations.subject,
        listingTitle: listings.title,
        listingSlug: listings.slug,
      })
      .from(conversations)
      .leftJoin(listings, eq(listings.id, conversations.listingId))
      .where(eq(conversations.id, id)),
    db
      .select({
        id: messages.id,
        body: messages.body,
        createdAt: messages.createdAt,
        senderId: messages.senderId,
        senderName: users.name,
        senderAvatar: users.avatarUrl,
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt))
      .limit(500),
    db
      .select({ id: users.id, name: users.name, role: users.role, avatarUrl: users.avatarUrl })
      .from(conversationParticipants)
      .innerJoin(users, eq(users.id, conversationParticipants.userId))
      .where(eq(conversationParticipants.conversationId, id)),
  ]);
  await markConversationRead(userId, id);
  return { ...conv, messages: thread, participants: people };
}

export async function markConversationRead(userId: string, id: string) {
  await getDb()
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, id),
        eq(conversationParticipants.userId, userId),
      ),
    );
}

export async function unreadConversationCount(userId: string): Promise<number> {
  try {
    const [row] = await getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
      .where(
        and(
          eq(conversationParticipants.userId, userId),
          sql`(${conversationParticipants.lastReadAt} is null or ${conversationParticipants.lastReadAt} < ${conversations.lastMessageAt})`,
        ),
      );
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}
