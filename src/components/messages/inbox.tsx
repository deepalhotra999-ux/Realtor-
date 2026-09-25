import Link from "next/link";
import type { listConversations } from "@/server/messages";
import { Avatar } from "@/components/ui/misc";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Conversation = Awaited<ReturnType<typeof listConversations>>[number];

export function Inbox({ items, activeId }: { items: Conversation[]; activeId?: string }) {
  if (items.length === 0)
    return (
      <p className="text-muted p-6 text-sm">
        No conversations yet. Contact an agent from any listing to start one.
      </p>
    );
  return (
    <ul className="divide-line divide-y">
      {items.map((c) => {
        const who = c.participants.map((p) => p.name).join(", ") || "Just you";
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              className={cn(
                "hover:bg-paper flex gap-3 px-4 py-3.5 transition",
                activeId === c.id && "bg-paper",
              )}
            >
              <Avatar
                name={c.participants[0]?.name ?? "?"}
                src={c.participants[0]?.avatarUrl}
                size={40}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}
                  >
                    {who}
                  </span>
                  <span className="text-muted shrink-0 text-xs">
                    {relativeTime(c.lastMessageAt)}
                  </span>
                </span>
                <span className="text-muted block truncate text-xs">
                  {c.listingTitle ?? c.subject ?? "Conversation"}
                </span>
                <span
                  className={cn("block truncate text-sm", c.unread ? "text-ink" : "text-muted")}
                >
                  {c.unread ? (
                    <span className="bg-brand-600 mr-1.5 inline-block size-2 rounded-full" />
                  ) : null}
                  {c.lastBody ?? ""}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
