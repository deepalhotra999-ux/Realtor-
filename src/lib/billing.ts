/** Pure billing helpers (period maths, pricing). No I/O. */

export type BillingInterval = "month" | "year";

/** End of a billing period, clamping month-ends (Jan 31 + 1 month → Feb 28/29). */
export function addInterval(start: Date, interval: BillingInterval, count = 1): Date {
  const d = new Date(start);
  const day = d.getUTCDate();
  if (interval === "year") d.setUTCFullYear(d.getUTCFullYear() + count, d.getUTCMonth(), 1);
  else d.setUTCMonth(d.getUTCMonth() + count, 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function addDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * 86_400_000);
}

export function priceFor(
  plan: { priceMonthly: number; priceAnnual: number },
  interval: BillingInterval,
): number {
  return interval === "year" ? plan.priceAnnual : plan.priceMonthly;
}

/** Percentage saved by paying annually (0 when not cheaper). */
export function annualSavingsPct(plan: { priceMonthly: number; priceAnnual: number }): number {
  const yearly = plan.priceMonthly * 12;
  if (yearly <= 0 || plan.priceAnnual <= 0 || plan.priceAnnual >= yearly) return 0;
  return Math.round(((yearly - plan.priceAnnual) / yearly) * 100);
}
