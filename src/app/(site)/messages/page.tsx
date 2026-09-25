import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listConversations } from "@/server/messages";
import { Inbox } from "@/components/messages/inbox";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser("/messages");
  const items = await listConversations(user.id);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display mb-6 text-4xl">Messages</h1>
      <div className="border-line bg-surface shadow-card grid grid-cols-1 overflow-hidden rounded-2xl border md:grid-cols-[340px_1fr]">
        <div className="border-line md:border-r">
          <Inbox items={items} />
        </div>
        <div className="text-muted hidden flex-col items-center justify-center p-10 text-center text-sm md:flex">
          <MessageSquare className="mb-3 size-8" />
          Select a conversation
        </div>
      </div>
    </div>
  );
}
