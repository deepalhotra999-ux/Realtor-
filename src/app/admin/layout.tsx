import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/session";
import { getModerationCounts } from "@/server/admin/queries";
import { pendingVerificationCount } from "@/server/trust/admin-queries";
import { DashboardShell, type NavGroup } from "@/components/admin/shell";
import { Avatar } from "@/components/ui/misc";
import { logoutAction } from "@/server/auth/actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Dwellwise" },
  robots: { index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [counts, pendingChecks] = await Promise.all([
    getModerationCounts(),
    pendingVerificationCount(),
  ]);
  const groups: NavGroup[] = [
    {
      items: [
        { href: "/admin", label: "Overview", icon: "gauge" },
        { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
      ],
    },
    {
      title: "Marketplace",
      items: [
        { href: "/admin/users", label: "Users", icon: "users" },
        { href: "/admin/agents", label: "Agents & brokers", icon: "building" },
        { href: "/admin/listings", label: "Listings", icon: "home" },
        { href: "/admin/leads", label: "Leads", icon: "inbox" },
      ],
    },
    {
      title: "Trust & safety",
      items: [
        {
          href: "/admin/verifications",
          label: "Verification queue",
          icon: "checklist",
          badge: pendingChecks,
        },
        { href: "/admin/reviews", label: "Reviews", icon: "star", badge: counts.reviews },
        { href: "/admin/reports", label: "Reports", icon: "alert", badge: counts.reports },
        { href: "/admin/audit", label: "Audit log", icon: "scroll" },
      ],
    },
    {
      title: "Monetization",
      items: [
        { href: "/admin/plans", label: "Plans & features", icon: "layers" },
        { href: "/admin/subscriptions", label: "Subscriptions & trials", icon: "card" },
      ],
    },
    {
      title: "Platform",
      items: [
        { href: "/admin/ai", label: "AI", icon: "sparkles" },
        { href: "/admin/notifications", label: "Notifications", icon: "bell" },
        { href: "/admin/jobs", label: "Background jobs", icon: "activity" },
        { href: "/admin/flags", label: "Feature flags", icon: "toggle" },
        { href: "/admin/settings", label: "Settings", icon: "settings" },
      ],
    },
  ];
  return (
    <DashboardShell
      title="Admin"
      root="/admin"
      groups={groups}
      footer={
        <div className="border-line bg-surface flex items-center gap-2.5 rounded-xl border p-2.5">
          <Avatar name={admin.name} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{admin.name}</p>
            <Link href="/" className="text-muted hover:text-ink text-xs">
              View site
            </Link>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-muted hover:text-ink text-xs">
              Sign out
            </button>
          </form>
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
