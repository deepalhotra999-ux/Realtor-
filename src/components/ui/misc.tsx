import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const badgeTones = {
  neutral: "bg-paper-2 text-ink-2",
  brand: "bg-brand-50 text-brand-700",
  clay: "bg-clay-50 text-clay-600",
  gold: "bg-gold-100 text-gold-700",
  sky: "bg-sky-100 text-sky-600",
  dark: "bg-ink/85 text-white backdrop-blur",
  white: "bg-white/92 text-ink backdrop-blur shadow-sm",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("border-line bg-surface shadow-card rounded-2xl border", className)}
      {...props}
    />
  );
}

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      style={{ ...style, background: `hsl(${hue} 32% 88%)`, color: `hsl(${hue} 35% 28%)` }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-line-strong bg-surface/60 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center">
      {icon ? (
        <div className="bg-brand-50 text-brand-600 mb-4 flex size-12 items-center justify-center rounded-2xl">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-ink text-xl">{title}</h3>
      {children ? <div className="text-muted mt-2 max-w-md text-sm">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow ? (
        <p className="text-brand-600 mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-ink text-3xl sm:text-4xl">{title}</h2>
      {children ? <p className="text-muted mt-3 max-w-2xl">{children}</p> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-line bg-surface shadow-card rounded-2xl border p-5", className)}>
      <p className="text-muted text-sm">{label}</p>
      <p className="text-ink tabular mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="text-muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-brand-600" />
        <path
          d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1h-4.5v-5.5h-5V25H9a1 1 0 0 1-1-1z"
          fill="#fff"
        />
        <circle cx="16" cy="16.2" r="1.9" className="fill-gold-500" />
      </svg>
      {withText ? (
        <span className="font-display text-ink text-xl font-semibold tracking-tight">
          Dwellwise
        </span>
      ) : null}
    </span>
  );
}
