import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { notifications, users } from "@/server/db/schema";
import { markAllNotificationsReadAction } from "@/server/actions/account";
import { ActionButton } from "@/components/admin/controls";
import { NotificationPrefsForm } from "@/components/account/notification-prefs-form";
import { Card, EmptyState } from "@/components/ui/misc";
import { parseNotificationPrefs } from "@/lib/notification-prefs";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const db = getDb();
  const [rows, [me]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(100),
    db.select({ preferences: users.preferences }).from(users).where(eq(users.id, user.id)),
  ]);
  const unread = rows.filter((r) => !r.readAt).length;
  const prefs = parseNotificationPrefs(me?.preferences?.notifications);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl">Notifications</h1>
            <p className="text-muted mt-2">
              {unread ? `${unread} unread` : "You're all caught up."}
            </p>
          </div>
          {unread ? (
            <ActionButton action={markAllNotificationsReadAction}>Mark all as read</ActionButton>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<Bell className="size-5" />} title="Nothing yet">
              Alerts, messages and tour updates will show up here.
            </EmptyState>
          </div>
        ) : (
          <Card className="divide-line mt-6 divide-y">
            {rows.map((n) => {
              const inner = (
                <>
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.readAt ? "bg-transparent" : "bg-brand-600",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.readAt && "font-semibold")}>
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="text-muted mt-0.5 block text-sm whitespace-pre-line">
                        {n.body.length > 400 ? `${n.body.slice(0, 400)}…` : n.body}
                      </span>
                    ) : null}
                    <span className="text-subtle mt-1 block text-xs">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                </>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className="hover:bg-paper flex gap-3 px-5 py-4">
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className="flex gap-3 px-5 py-4">
                  {inner}
                </div>
              );
            })}
          </Card>
        )}
      </div>
      <aside>
        <Card className="p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">Preferences</h2>
          <p className="text-muted mt-1 mb-4 text-xs">Choose what reaches you, and where.</p>
          <NotificationPrefsForm prefs={prefs} />
        </Card>
      </aside>
    </div>
  );
}
