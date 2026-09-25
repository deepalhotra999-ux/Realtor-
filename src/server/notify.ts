import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { notifications, outboundMessages, users } from "@/server/db/schema";
import { getEmail, getSms } from "@/providers";
import { getEnv } from "@/lib/env";
import { parseNotificationPrefs, wantsNotification } from "@/lib/notification-prefs";

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Minimal branded HTML wrapper for transactional email. */
export function renderEmail(title: string, body: string, cta?: { label: string; href: string }) {
  const url = cta ? new URL(cta.href, getEnv().APP_URL).toString() : null;
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:Inter,Arial,sans-serif;color:#18231f">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="font-weight:700;font-size:18px;color:#0f5c4c;margin-bottom:24px">Dwellwise</div>
<div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #e7e2d8">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 20px;white-space:pre-line">${escapeHtml(body)}</p>
${url ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#0f5c4c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${escapeHtml(cta!.label)}</a>` : ""}
</div></div></body></html>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  cta?: { label: string; href: string },
) {
  const provider = getEmail();
  const html = renderEmail(subject, text, cta);
  const result = await provider.send({ to, subject, text, html }).catch((err: Error) => ({
    status: "failed" as const,
    error: err.message,
  }));
  await getDb()
    .insert(outboundMessages)
    .values({
      channel: "email",
      provider: provider.name,
      to,
      subject,
      body: text,
      html,
      status: result.status === "failed" ? "failed" : "sent",
      error: "error" in result ? result.error : null,
    });
  return result;
}

export async function sendSms(to: string, body: string) {
  const provider = getSms();
  const result = await provider.send({ to, body });
  await getDb()
    .insert(outboundMessages)
    .values({
      channel: "sms",
      provider: provider.name,
      to,
      body,
      status: result.status === "failed" ? "failed" : "sent",
      error: result.error ?? null,
    });
  return result;
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  try {
    const [row] = await getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/**
 * In-app notification, optionally mirrored to email. Both channels honour the
 * recipient's preferences (`users.preferences.notifications`).
 */
export async function notify(
  userId: string,
  n: { type: string; title: string; body?: string; link?: string },
  opts: { email?: boolean } = {},
) {
  const db = getDb();
  const [u] = await db
    .select({ email: users.email, preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return;
  const prefs = parseNotificationPrefs(u.preferences?.notifications);
  if (wantsNotification(prefs, n.type, "inApp"))
    await db.insert(notifications).values({ userId, ...n });
  if (opts.email && wantsNotification(prefs, n.type, "email"))
    await sendEmail(
      u.email,
      n.title,
      n.body ?? "",
      n.link ? { label: "Open Dwellwise", href: n.link } : undefined,
    );
}
