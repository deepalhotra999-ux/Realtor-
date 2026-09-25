"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import {
  conversationParticipants,
  conversations,
  leads,
  listings,
  messages,
} from "@/server/db/schema";
import { requirePro, requireUser } from "@/server/auth/session";
import { markConversationRead } from "@/server/messages";
import { notify } from "@/server/notify";

export type MessageState = { ok?: boolean; error?: string } | undefined;

export async function sendMessageAction(
  conversationId: string,
  _prev: MessageState,
  form: FormData,
): Promise<MessageState> {
  const user = await requireUser("/messages");
  const id = z.string().uuid().parse(conversationId);
  const body = z.string().trim().min(1).max(4000).safeParse(form.get("body"));
  if (!body.success) return { error: "Write a message first." };
  const db = getDb();
  const members = await db
    .select({
      userId: conversationParticipants.userId,
      lastReadAt: conversationParticipants.lastReadAt,
      prevMessageAt: conversations.lastMessageAt,
    })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
    .where(eq(conversationParticipants.conversationId, id));
  if (!members.some((m) => m.userId === user.id)) return { error: "Conversation not found." };

  await db.insert(messages).values({ conversationId: id, senderId: user.id, body: body.data });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, id));
  await markConversationRead(user.id, id);

  // Notify others only if they had read everything before this message, so a
  // burst of messages produces one notification rather than one per message.
  const caughtUp = members.filter(
    (m) => m.userId !== user.id && (!m.lastReadAt || m.lastReadAt >= m.prevMessageAt),
  );
  await Promise.all(
    caughtUp.map((m) =>
      notify(
        m.userId,
        {
          type: "message",
          title: `New message from ${user.name}`,
          body: body.data.slice(0, 280),
          link: `/messages/${id}`,
        },
        { email: true },
      ),
    ),
  );
  revalidatePath(`/messages/${id}`);
  revalidatePath("/messages");
  return { ok: true };
}

/** Agent → lead: open (or reuse) a conversation with a lead who has an account. */
export async function messageLeadAction(leadId: string) {
  const user = await requirePro();
  const db = getDb();
  const [lead] = await db
    .select({
      contactUserId: leads.contactUserId,
      listingId: leads.listingId,
      name: leads.name,
      title: listings.title,
    })
    .from(leads)
    .leftJoin(listings, eq(listings.id, leads.listingId))
    .where(and(eq(leads.id, z.string().uuid().parse(leadId)), eq(leads.ownerId, user.id)))
    .limit(1);
  if (!lead?.contactUserId) throw new Error("This lead doesn't have a Dwellwise account.");

  const mine = db
    .select({ id: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, user.id));
  const [existing] = await db
    .select({ id: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
    .where(
      and(
        eq(conversationParticipants.userId, lead.contactUserId),
        inArray(conversationParticipants.conversationId, mine),
        lead.listingId ? eq(conversations.listingId, lead.listingId) : undefined,
      ),
    )
    .limit(1);
  if (existing) redirect(`/messages/${existing.id}`);

  const [conv] = await db
    .insert(conversations)
    .values({ subject: lead.title ?? `Conversation with ${lead.name}`, listingId: lead.listingId })
    .returning({ id: conversations.id });
  await db.insert(conversationParticipants).values([
    { conversationId: conv.id, userId: user.id, lastReadAt: new Date() },
    { conversationId: conv.id, userId: lead.contactUserId },
  ]);
  redirect(`/messages/${conv.id}`);
}
