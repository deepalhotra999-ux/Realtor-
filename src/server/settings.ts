import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { appSettings, auditLogs, featureFlags } from "@/server/db/schema";
import {
  parseSettings,
  SETTINGS_SECTIONS,
  type SettingsOf,
  type SettingsSection,
} from "@/lib/settings-schema";
import { evaluateFlag, type FlagSubject } from "@/lib/flags";

/**
 * Settings are read on almost every request, so they are cached in-process
 * for a few seconds. Writes invalidate the local cache immediately.
 */
const TTL_MS = 5_000;
const cache = new Map<string, { value: unknown; at: number }>();

export async function getSettings<S extends SettingsSection>(section: S): Promise<SettingsOf<S>> {
  const hit = cache.get(section);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as SettingsOf<S>;
  let raw: unknown = {};
  try {
    const [row] = await getDb()
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, section))
      .limit(1);
    raw = row?.value ?? {};
  } catch (err) {
    // A missing/unmigrated database must not take pages down; defaults are safe.
    console.warn(`[settings] falling back to defaults for "${section}":`, (err as Error).message);
  }
  const value = parseSettings(section, raw);
  cache.set(section, { value, at: Date.now() });
  return value;
}

export async function updateSettings<S extends SettingsSection>(
  section: S,
  patch: Partial<SettingsOf<S>>,
  actorId: string | null,
): Promise<SettingsOf<S>> {
  const current = await getSettings(section);
  const next = SETTINGS_SECTIONS[section].parse({ ...current, ...patch }) as SettingsOf<S>;
  const db = getDb();
  await db
    .insert(appSettings)
    .values({ key: section, value: next, updatedById: actorId })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedById: actorId, updatedAt: new Date() },
    });
  await db.insert(auditLogs).values({
    actorId,
    action: `settings.${section}.update`,
    targetType: "settings",
    targetId: section,
    meta: { patch },
  });
  cache.delete(section);
  return next;
}

let flagCache: { rows: (typeof featureFlags.$inferSelect)[]; at: number } | null = null;

export async function listFlags() {
  if (flagCache && Date.now() - flagCache.at < TTL_MS) return flagCache.rows;
  try {
    const rows = await getDb().select().from(featureFlags);
    flagCache = { rows, at: Date.now() };
    return rows;
  } catch {
    return [];
  }
}

export async function isFlagEnabled(key: string, subject?: FlagSubject): Promise<boolean> {
  const flags = await listFlags();
  return evaluateFlag(
    flags.find((f) => f.key === key),
    subject,
  );
}

export function invalidateFlagCache() {
  flagCache = null;
}
