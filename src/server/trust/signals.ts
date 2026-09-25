import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getDb } from "@/server/db";
import { accountSignals } from "@/server/db/schema";
import { getEnv } from "@/lib/env";

/**
 * Security signals for abuse detection (signup, login …). We keep the IP, a
 * coarse network prefix, and a salted hash of coarse browser traits — never a
 * raw fingerprint. Shared networks are normal, so these are only ever one
 * input among many to the risk engine; nothing is blocked on an IP alone.
 */

export function ipPrefix(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + "::/48";
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.0/24` : null;
}

export async function requestFingerprint() {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const traits = [h.get("user-agent") ?? "", h.get("accept-language") ?? ""].join("|");
    const deviceHash = createHmac("sha256", getEnv().AUTH_SECRET)
      .update(traits)
      .digest("hex")
      .slice(0, 32);
    return { ip, ipPrefix: ipPrefix(ip), deviceHash };
  } catch {
    return { ip: null, ipPrefix: null, deviceHash: null };
  }
}

export async function recordSignal(
  userId: string | null,
  kind: string,
  meta: Record<string, unknown> = {},
) {
  const fp = await requestFingerprint();
  await getDb()
    .insert(accountSignals)
    .values({ userId, kind, ip: fp.ip, ipPrefix: fp.ipPrefix, deviceHash: fp.deviceHash, meta })
    .catch(() => {});
  return fp;
}
