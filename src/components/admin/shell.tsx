"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CreditCard,
  Flag,
  Gauge,
  Heart,
  Home,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  ToggleRight,
  Users,
  X,
} from "lucide-react";

const ICONS = {
  activity: Activity,
  analytics: BarChart3,
  bell: Bell,
  book: BookOpen,
  briefcase: Briefcase,
  building: Building2,
  calendar: CalendarDays,
  card: CreditCard,
  flag: Flag,
  gauge: Gauge,
  heart: Heart,
  home: Home,
  inbox: Inbox,
  key: KeyRound,
  layers: Layers,
  dashboard: LayoutDashboard,
  checklist: ListChecks,
  message: MessageSquare,
  scroll: ScrollText,
  settings: Settings,
  alert: ShieldAlert,
  sparkles: Sparkles,
  star: Star,
  toggle: ToggleRight,
  users: Users,
} as const;
export type IconName = keyof typeof ICONS;
import { Logo } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export function DashboardShell({
  groups,
  title,
  children,
  footer,
  root,
}: {
  groups: NavGroup[];
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  root: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  const active = (href: string) => (href === root ? pathname === root : pathname.startsWith(href));

  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title ? (
            <p className="text-subtle mb-1.5 px-3 text-[11px] font-semibold tracking-wider uppercase">
              {g.title}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                    active(it.href)
                      ? "bg-surface text-ink ring-line font-medium shadow-sm ring-1"
                      : "text-ink-2 hover:bg-surface/70 hover:text-ink",
                  )}
                >
                  {(() => {
                    const Icon = ICONS[it.icon];
                    return (
                      <Icon
                        className={cn("size-4", active(it.href) ? "text-brand-600" : "text-muted")}
                      />
                    );
                  })()}
                  <span className="flex-1">{it.label}</span>
                  {it.badge ? (
                    <span className="bg-clay-500 rounded-full px-1.5 text-[11px] font-semibold text-white">
                      {it.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </nav>
  );

  return (
    <div className="bg-paper flex min-h-dvh">
      <aside className="border-line bg-paper-2/60 sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="border-line flex h-16 items-center gap-2 border-b px-5">
          <Link href="/">
            <Logo />
          </Link>
          <span className="bg-ink rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
            {title}
          </span>
        </div>
        {nav}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="bg-ink/30 absolute inset-0" onClick={() => setOpen(false)} />
          <aside className="bg-paper shadow-pop absolute inset-y-0 left-0 flex w-72 flex-col">
            <div className="border-line flex h-16 items-center justify-between border-b px-5">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-line bg-paper flex h-14 items-center gap-3 border-b px-4 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Logo />
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
