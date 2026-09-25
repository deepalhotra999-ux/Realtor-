"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SendHorizontal } from "lucide-react";
import { sendMessageAction } from "@/server/actions/messages";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
}

const POLL_MS = 8000;

export function Thread({
  conversationId,
  meId,
  messages,
}: {
  conversationId: string;
  meId: string;
  messages: ThreadMessage[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    sendMessageAction.bind(null, conversationId),
    undefined,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Lightweight live updates: re-render the server component while visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 ? (
          <li className="text-muted py-10 text-center text-sm">Say hello 👋</li>
        ) : null}
        {messages.map((m, i) => {
          const mine = m.senderId === meId;
          const showHeader = i === 0 || messages[i - 1].senderId !== m.senderId;
          return (
            <li key={m.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
              <div className="w-8 shrink-0">
                {showHeader ? <Avatar name={m.senderName} src={m.senderAvatar} size={32} /> : null}
              </div>
              <div className={cn("max-w-[75%]", mine && "text-right")}>
                {showHeader ? (
                  <p className="text-muted mb-1 text-xs">
                    {mine ? "You" : m.senderName} ·{" "}
                    {new Date(m.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "inline-block rounded-2xl px-3.5 py-2 text-left text-sm whitespace-pre-wrap",
                    mine ? "bg-brand-600 text-white" : "bg-paper-2 text-ink",
                  )}
                >
                  {m.body}
                </p>
              </div>
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>
      <form
        ref={formRef}
        action={action}
        className="border-line flex items-end gap-2 border-t p-3 sm:p-4"
      >
        <Textarea
          name="body"
          rows={2}
          required
          maxLength={4000}
          placeholder="Write a message…"
          aria-label="Message"
          className="min-h-11 flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={pending} aria-label="Send">
          <SendHorizontal className="size-4" />
        </Button>
      </form>
      {state?.error ? <p className="text-clay-600 px-4 pb-3 text-xs">{state.error}</p> : null}
    </div>
  );
}
