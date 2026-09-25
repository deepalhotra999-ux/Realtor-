import "server-only";
import { getDb } from "@/server/db";
import { auditLogs } from "@/server/db/schema";

/**
 * AuditLogService. Every important automated or manual action goes through
 * `recordAudit`. Admin actions name the administrator; SYSTEM actions name the
 * automation rule/job; USER actions name the user.
 */
export type AuditActor =
  { type: "system"; rule: string } | { type: "admin"; id: string } | { type: "user"; id: string };

export const system = (rule: string): AuditActor => ({ type: "system", rule });
export const admin = (id: string): AuditActor => ({ type: "admin", id });
export const user = (id: string): AuditActor => ({ type: "user", id });

export interface AuditEntry {
  actor: AuditActor;
  action: string;
  target?: { type: string; id: string };
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
}

/** Best-effort request metadata; empty outside a request (e.g. the worker). */
async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Keep only fields that changed, so before/after stay small and readable. */
export function diffState(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
) {
  if (!before || !after) return { before: before ?? null, after: after ?? null };
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const x = before[k] instanceof Date ? (before[k] as Date).toISOString() : before[k];
    const y = after[k] instanceof Date ? (after[k] as Date).toISOString() : after[k];
    if (JSON.stringify(x) !== JSON.stringify(y)) {
      b[k] = x ?? null;
      a[k] = y ?? null;
    }
  }
  return { before: b, after: a };
}

export async function recordAudit(e: AuditEntry) {
  const { ip, userAgent } =
    e.actor.type === "system" ? { ip: null, userAgent: null } : await requestMeta();
  const { before, after } = diffState(e.before, e.after);
  await getDb()
    .insert(auditLogs)
    .values({
      actorType: e.actor.type,
      actorId: e.actor.type === "system" ? null : e.actor.id,
      actorLabel: e.actor.type === "system" ? e.actor.rule : null,
      action: e.action,
      targetType: e.target?.type ?? null,
      targetId: e.target?.id ?? null,
      reason: e.reason ?? null,
      before,
      after,
      meta: e.meta ?? {},
      ip,
      userAgent,
    });
}
