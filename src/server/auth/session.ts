import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { getEnv } from "@/lib/env";

/**
 * Self-hosted session auth. The browser holds a random 256-bit token in an
 * httpOnly cookie; the database stores only its SHA-256, so a leaked DB dump
 * cannot be replayed as sessions.
 */
export const SESSION_COOKIE = "dw_session";
const SESSION_DAYS = 30;
const REFRESH_WHEN_DAYS_LEFT = 15;

export type Role = (typeof users.$inferSelect)["role"];
export type SessionUser = Pick<
  typeof users.$inferSelect,
  "id" | "email" | "name" | "role" | "status" | "avatarUrl" | "phone"
>;

export const PRO_ROLES: Role[] = ["agent", "broker", "property_manager", "developer", "admin"];

/** Account statuses that cannot sign in or keep a session. */
export const BLOCKED_STATUSES: SessionUser["status"][] = ["suspended", "banned", "deleted"];

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await getDb()
    .insert(sessions)
    .values({ id: hashToken(token), userId, expiresAt, userAgent: ua });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    await getDb()
      .delete(sessions)
      .where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Current user for this request (memoised per render). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const db = getDb();
    const id = hashToken(token);
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
        avatarUrl: users.avatarUrl,
        phone: users.phone,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!row || BLOCKED_STATUSES.includes(row.status)) return null;

    // Sliding expiry: extend long-lived sessions in the background.
    if (row.expiresAt.getTime() - Date.now() < REFRESH_WHEN_DAYS_LEFT * 86_400_000) {
      void db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) })
        .where(eq(sessions.id, id))
        .catch(() => {});
    }
    const { expiresAt: _e, ...user } = row;
    void _e;
    return user;
  } catch {
    return null;
  }
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireRole(roles: Role[], next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect("/?denied=1");
  return user;
}

export const requireAdmin = (next = "/admin") => requireRole(["admin"], next);
export const requirePro = (next = "/pro") => requireRole(PRO_ROLES, next);

export async function purgeExpiredSessions() {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
