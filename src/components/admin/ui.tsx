import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("border-line bg-surface shadow-card rounded-2xl border", className)}>
      {title ? (
        <div className="border-line flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">{title}</h2>
            {description ? <p className="text-muted mt-0.5 text-xs">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "border-line bg-surface shadow-card overflow-x-auto rounded-2xl border",
        className,
      )}
    >
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-line bg-paper/70 text-muted border-b px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn("border-line/70 border-b px-4 py-3 align-middle", className)}>{children}</td>
  );
}

const tones = {
  green: "bg-brand-50 text-brand-700 ring-brand-200",
  gray: "bg-paper-2 text-ink-2 ring-line",
  amber: "bg-gold-100 text-gold-700 ring-gold-500/30",
  red: "bg-clay-50 text-clay-600 ring-clay-100",
  blue: "bg-sky-100 text-sky-600 ring-sky-600/20",
  dark: "bg-ink text-white ring-ink",
} as const;
export type Tone = keyof typeof tones;

export function Pill({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export const STATUS_TONES: Record<string, Tone> = {
  active: "green",
  published: "green",
  succeeded: "green",
  sent: "green",
  confirmed: "green",
  completed: "green",
  closed_won: "green",
  resolved: "green",
  trialing: "blue",
  coming_soon: "blue",
  requested: "blue",
  new: "blue",
  reviewing: "blue",
  queued: "blue",
  pending: "amber",
  past_due: "amber",
  flagged: "amber",
  open: "amber",
  draft: "gray",
  suspended: "red",
  removed: "red",
  failed: "red",
  canceled: "gray",
  cancelled: "gray",
  expired: "gray",
  dismissed: "gray",
  closed_lost: "gray",
  off_market: "gray",
  sold: "dark",
  rented: "dark",
};

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONES[status] ?? "gray"}>{status.replace(/_/g, " ")}</Pill>;
}

export function KPI({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: ReactNode;
  delta?: { value: number; good?: "up" | "down" };
  hint?: ReactNode;
}) {
  const positive = delta ? (delta.good === "down" ? delta.value < 0 : delta.value > 0) : false;
  return (
    <div className="border-line bg-surface shadow-card rounded-2xl border p-5">
      <p className="text-muted text-sm">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-muted mt-1 flex items-center gap-2 text-xs">
        {delta && Number.isFinite(delta.value) ? (
          <span
            className={cn(
              "font-medium",
              delta.value === 0 ? "text-muted" : positive ? "text-brand-600" : "text-clay-600",
            )}
          >
            {delta.value > 0 ? "▲" : delta.value < 0 ? "▼" : "•"} {Math.abs(delta.value).toFixed(0)}
            %
          </span>
        ) : null}
        {hint}
      </p>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  href,
}: {
  page: number;
  pageSize: number;
  total: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="text-muted mt-4 flex items-center justify-between text-sm">
      <p>
        {total === 0
          ? "No results"
          : `${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)} of ${total.toLocaleString("en-US")}`}
      </p>
      <div className="flex items-center gap-1">
        <Link
          aria-disabled={page <= 1}
          href={href(Math.max(1, page - 1))}
          className={cn(
            "border-line bg-surface inline-flex size-8 items-center justify-center rounded-lg border",
            page <= 1 && "pointer-events-none opacity-40",
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span className="tabular px-2">
          {page} / {pages}
        </span>
        <Link
          aria-disabled={page >= pages}
          href={href(Math.min(pages, page + 1))}
          className={cn(
            "border-line bg-surface inline-flex size-8 items-center justify-center rounded-lg border",
            page >= pages && "pointer-events-none opacity-40",
          )}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

/** Tab-like filter links for list pages. */
export function FilterTabs({
  tabs,
  current,
}: {
  tabs: { value: string; label: string; href: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="bg-paper-2 mb-4 flex flex-wrap gap-1 rounded-xl p-1 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.value}
          href={t.href}
          className={cn(
            "rounded-lg px-3 py-1.5 transition",
            current === t.value ? "bg-surface font-medium shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined ? (
            <span className="text-muted tabular ml-1.5 text-xs">{t.count}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
