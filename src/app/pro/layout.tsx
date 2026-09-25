import type { Metadata } from "next";
import Link from "next/link";
import { requirePro } from "@/server/auth/session";
import { canUseProAccount } from "@/server/entitlements";
import { unreadConversationCount } from "@/server/messages";
import { logoutAction } from "@/server/auth/actions";
import { DashboardShell, type NavGroup } from "@/components/admin/shell";
import { Avatar } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { default: "Pro workspace", template: "%s · Pro · Dwellwise" },
  robots: { index: false },
};

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePro();
  const [allowed, unread] = await Promise.all([
    user.role === "admin" ? true : canUseProAccount(user.id),
    unreadConversationCount(user.id),
  ]);
  const groups: NavGroup[] = [
    {
      items: [
        { href: "/pro", label: "Overview", icon: "dashboard" },
        { href: "/pro/listings", label: "Listings", icon: "home" },
        { href: "/pro/leads", label: "Leads", icon: "inbox" },
        { href: "/pro/tours", label: "Tours", icon: "calendar" },
        { href: "/messages", label: "Messages", icon: "message", badge: unread },
        { href: "/pro/analytics", label: "Analytics", icon: "analytics" },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/pro/profile", label: "Agent profile", icon: "users" },
        { href: "/billing", label: "Plan & billing", icon: "card" },
        { href: "/notifications", label: "Notifications", icon: "bell" },
      ],
    },
  ];
  return (
    <DashboardShell
      title="Pro"
      root="/pro"
      groups={groups}
      footer={
        <div className="border-line bg-surface flex items-center gap-2.5 rounded-xl border p-2.5">
          <Avatar name={user.name} src={user.avatarUrl} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
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
      {allowed ? (
        children
      ) : (
        <div className="mx-auto max-w-lg py-16 text-center">
          <h1 className="font-display text-3xl">Choose a plan to continue</h1>
          <p className="text-muted mt-3">
            Professional accounts need an active plan on this marketplace. Start a free trial to
            manage listings, leads and tours.
          </p>
          <ButtonLink href="/pricing" className="mt-6">
            See plans
          </ButtonLink>
        </div>
      )}
    </DashboardShell>
  );
}
