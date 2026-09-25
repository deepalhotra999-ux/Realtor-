import "server-only";
import { eq, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { savedSearches } from "@/server/db/schema";
import { notify } from "@/server/notify";
import { getSearch } from "@/providers";
import { alertTitle, isAlertDue, newMatchesSince } from "@/lib/alerts";
import { searchQuerySchema, toSearchParams } from "@/lib/search/query";
import { formatPrice } from "@/lib/format";

export interface AlertRunResult {
  checked: number;
  due: number;
  notified: number;
  listings: number;
  errors: number;
}

/**
 * Saved-search alerts. Safe to run as often as you like: each search is only
 * processed when its frequency says it's due, and the window always advances
 * so the same listing is never announced twice.
 */
export async function runSavedSearchAlerts(now = new Date()): Promise<AlertRunResult> {
  const db = getDb();
  const rows = await db.select().from(savedSearches).where(ne(savedSearches.alertFrequency, "off"));
  const result: AlertRunResult = {
    checked: rows.length,
    due: 0,
    notified: 0,
    listings: 0,
    errors: 0,
  };

  for (const s of rows) {
    if (!isAlertDue(s.alertFrequency, s.lastNotifiedAt, now)) continue;
    result.due++;
    try {
      const parsed = searchQuerySchema.safeParse(s.criteria);
      if (parsed.success) {
        const since = s.lastNotifiedAt ?? s.createdAt;
        const res = await getSearch().search({
          ...parsed.data,
          sort: "newest",
          page: 1,
          pageSize: 25,
        });
        const fresh = newMatchesSince(res.items, since);
        if (fresh.length) {
          const lines = fresh
            .slice(0, 5)
            .map(
              (l) =>
                `• ${l.title} — ${formatPrice(l.price, l.listingType)} · ${l.city}, ${l.state}`,
            );
          if (fresh.length > 5) lines.push(`…and ${fresh.length - 5} more.`);
          await notify(
            s.userId,
            {
              type: "alert",
              title: alertTitle(s.name, fresh.length),
              body: lines.join("\n"),
              link: `/search?${toSearchParams({ ...parsed.data, sort: "newest", page: 1 })}`,
            },
            { email: true },
          );
          result.notified++;
          result.listings += fresh.length;
        }
      }
      await db.update(savedSearches).set({ lastNotifiedAt: now }).where(eq(savedSearches.id, s.id));
    } catch (err) {
      result.errors++;
      console.error(`[alerts] saved search ${s.id}:`, (err as Error).message);
    }
  }
  return result;
}
