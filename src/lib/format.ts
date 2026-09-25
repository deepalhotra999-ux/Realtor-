import type { ListingType } from "@/lib/domain";

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-US");

export function formatPrice(value: number | null | undefined, listingType?: ListingType) {
  if (value === null || value === undefined) return "—";
  return `${usd0.format(value)}${listingType === "rent" ? "/mo" : ""}`;
}

/** $1.2M, $845K, $2,450 — for map pins and dense UI. */
export function formatCompactPrice(value: number, listingType?: ListingType) {
  if (listingType === "rent" || value < 10_000) return `$${num.format(value)}`;
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `$${m >= 10 ? m.toFixed(0) : m.toFixed(m % 1 < 0.05 ? 0 : 2).replace(/0$/, "")}M`;
  }
  return `$${Math.round(value / 1000)}K`;
}

export function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : num.format(value);
}

export function formatBaths(b: number | null | undefined) {
  if (b === null || b === undefined) return "—";
  return Number.isInteger(b) ? String(b) : b.toFixed(1);
}

export function formatAcres(lotSqft: number | null | undefined) {
  if (!lotSqft) return null;
  const acres = lotSqft / 43_560;
  return acres >= 0.25 ? `${acres.toFixed(2)} acres` : `${num.format(lotSqft)} sqft lot`;
}

export function formatAddress(p: {
  street: string;
  unit?: string | null;
  city: string;
  state: string;
  postalCode?: string;
}) {
  return `${p.street}${p.unit ? ` ${p.unit}` : ""}, ${p.city}, ${p.state}${p.postalCode ? ` ${p.postalCode}` : ""}`;
}

export function daysSince(iso: string | Date | null | undefined, now = new Date()) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

export function relativeTime(date: Date | string, now = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (d.getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86_400 * 30) return rtf.format(Math.round(diff / 86_400), "day");
  if (abs < 86_400 * 365) return rtf.format(Math.round(diff / (86_400 * 30)), "month");
  return rtf.format(Math.round(diff / (86_400 * 365)), "year");
}

export function formatDate(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
) {
  return new Intl.DateTimeFormat("en-US", opts).format(
    typeof date === "string" ? new Date(date) : date,
  );
}

export function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
