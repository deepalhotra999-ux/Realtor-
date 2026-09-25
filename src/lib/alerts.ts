/** Pure saved-search alert scheduling and matching. No I/O. */

export type AlertFrequency = "instant" | "daily" | "weekly" | "off";

const HOUR = 3_600_000;

/**
 * Minimum gap between alerts per frequency. "instant" still has a small floor
 * so a job running every few minutes can't email the same person repeatedly.
 * Daily/weekly allow an hour of slack so a job on a fixed schedule doesn't
 * drift a full cycle when it runs a few minutes early.
 */
const MIN_GAP_MS: Record<Exclude<AlertFrequency, "off">, number> = {
  instant: 10 * 60_000,
  daily: 23 * HOUR,
  weekly: 7 * 24 * HOUR - HOUR,
};

export function isAlertDue(
  frequency: AlertFrequency,
  lastNotifiedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (frequency === "off") return false;
  if (!lastNotifiedAt) return true;
  return now.getTime() - lastNotifiedAt.getTime() >= MIN_GAP_MS[frequency];
}

/** Listings published after `since`, newest first. Unlisted items never match. */
export function newMatchesSince<T extends { listedAt: string | null }>(
  items: T[],
  since: Date,
): T[] {
  return items
    .filter((i) => i.listedAt !== null && new Date(i.listedAt) > since)
    .sort((a, b) => new Date(b.listedAt!).getTime() - new Date(a.listedAt!).getTime());
}

export function alertTitle(searchName: string, count: number) {
  return `${count} new home${count === 1 ? "" : "s"} for “${searchName}”`;
}
