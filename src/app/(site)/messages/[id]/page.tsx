import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { getConversation, listConversations } from "@/server/messages";
import { Inbox } from "@/components/messages/inbox";
import { Thread } from "@/components/messages/thread";

export const metadata: Metadata = { title: "Messages" };

export default async function ConversationPage(props: PageProps<"/messages/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/messages/${id}`);
  if (!z.string().uuid().safeParse(id).success) notFound();
  // Load the thread first: it marks the conversation read before the inbox renders.
  const conv = await getConversation(user.id, id);
  if (!conv) notFound();
  const items = await listConversations(user.id);
  const others = conv.participants.filter((p) => p.id !== user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display mb-6 hidden text-4xl md:block">Messages</h1>
      <div className="border-line bg-surface shadow-card grid h-[calc(100dvh-12rem)] min-h-[480px] overflow-hidden rounded-2xl border md:grid-cols-[340px_1fr]">
        <div className="border-line hidden overflow-y-auto md:block md:border-r">
          <Inbox items={items} activeId={id} />
        </div>
        <div className="flex min-h-0 flex-col">
          <header className="border-line flex items-center gap-3 border-b px-4 py-3">
            <Link href="/messages" className="text-muted text-sm md:hidden">
              ←
            </Link>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {others.map((o) => o.name).join(", ") || "Conversation"}
              </p>
              {conv.listingSlug ? (
                <Link
                  href={`/homes/${conv.listingSlug}`}
                  className="text-brand-600 truncate text-xs"
                >
                  {conv.listingTitle}
                </Link>
              ) : conv.subject ? (
                <p className="text-muted truncate text-xs">{conv.subject}</p>
              ) : null}
            </div>
          </header>
          <Thread
            conversationId={id}
            meId={user.id}
            messages={conv.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          />
        </div>
      </div>
    </div>
  );
}
