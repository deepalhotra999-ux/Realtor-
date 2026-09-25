"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Briefcase,
  CreditCard,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { logoutAction } from "@/server/auth/actions";

type MenuUser = { name: string; email: string; role: string; avatarUrl: string | null };

export function UserMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pro = ["agent", "broker", "property_manager", "admin"].includes(user.role);
  const item =
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-2 hover:bg-paper hover:text-ink";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="border-line bg-surface hover:shadow-card flex items-center gap-2 rounded-full border p-1 pr-3 shadow-sm transition"
      >
        <Avatar name={user.name} src={user.avatarUrl} size={30} />
        <span className="hidden max-w-28 truncate text-sm font-medium sm:block">
          {user.name.split(" ")[0]}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="animate-fade-up border-line bg-surface shadow-pop absolute right-0 mt-2 w-64 rounded-2xl border p-2"
          onClick={() => setOpen(false)}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="text-muted truncate text-xs">{user.email}</p>
          </div>
          <div className="bg-line my-1 h-px" />
          <Link href="/for-you" className={item}>
            <Sparkles className="size-4" /> For you
          </Link>
          <Link href="/favorites" className={item}>
            <Heart className="size-4" /> Saved homes
          </Link>
          <Link href="/saved-searches" className={item}>
            <Search className="size-4" /> Saved searches
          </Link>
          <Link href="/boards" className={item}>
            <Users className="size-4" /> Shared boards
          </Link>
          <Link href="/messages" className={item}>
            <MessageSquare className="size-4" /> Messages
          </Link>
          <Link href="/notifications" className={item}>
            <Bell className="size-4" /> Notifications
          </Link>
          {pro ? (
            <Link href="/billing" className={item}>
              <CreditCard className="size-4" /> Plan & billing
            </Link>
          ) : null}
          {pro ? (
            <>
              <div className="bg-line my-1 h-px" />
              <Link href="/pro" className={item}>
                <Briefcase className="size-4" /> Pro workspace
              </Link>
            </>
          ) : null}
          {user.role === "admin" ? (
            <Link href="/admin" className={item}>
              <Shield className="size-4" /> Admin panel
            </Link>
          ) : null}
          {!pro ? (
            <Link href="/sell" className={item}>
              <LayoutDashboard className="size-4" /> List a property
            </Link>
          ) : null}
          <div className="bg-line my-1 h-px" />
          <form action={logoutAction}>
            <button type="submit" className={`${item} w-full`}>
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
