import Link from "next/link";
import { Bell, Heart, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { unreadNotificationCount } from "@/server/notify";
import { Logo } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { MAIN_NAV } from "./nav-links";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await unreadNotificationCount(user.id) : 0;
  return (
    <header className="border-line/80 bg-paper/85 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <MobileNav user={user ? { name: user.name, role: user.role } : null} />
        <Link href="/" aria-label="Dwellwise home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "highlight" in item
                  ? "bg-brand-50 text-brand-700 hover:bg-brand-100 ml-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition"
                  : "text-ink-2 hover:bg-ink/5 hover:text-ink rounded-full px-3 py-1.5 text-sm font-medium transition"
              }
            >
              {"highlight" in item ? <Sparkles className="size-3.5" /> : null}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/favorites"
            className="text-ink-2 hover:bg-ink/5 hover:text-ink hidden size-10 items-center justify-center rounded-full transition sm:inline-flex"
            aria-label="Saved homes"
          >
            <Heart className="size-5" />
          </Link>
          {user ? (
            <Link
              href="/notifications"
              className="text-ink-2 hover:bg-ink/5 hover:text-ink relative inline-flex size-10 items-center justify-center rounded-full transition"
              aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
            >
              <Bell className="size-5" />
              {unread ? (
                <span className="bg-clay-500 absolute top-1 right-1 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          {user ? (
            <UserMenu
              user={{
                name: user.name,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
              }}
            />
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign in
              </ButtonLink>
              <ButtonLink href="/register" size="sm">
                Join free
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
