"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/misc";
import { MAIN_NAV } from "./nav-links";

export function MobileNav({ user }: { user: { name: string; role: string } | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close on navigation (adjust state during render rather than in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="text-ink-2 hover:bg-ink/5 -ml-2 inline-flex size-10 items-center justify-center rounded-full lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="bg-ink/30 absolute inset-0 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="animate-fade-up bg-paper shadow-pop absolute inset-y-0 left-0 flex w-[84%] max-w-sm flex-col p-5">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="hover:bg-ink/5 inline-flex size-10 items-center justify-center rounded-full"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {MAIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-ink hover:bg-surface rounded-xl px-3 py-3 text-base font-medium"
                >
                  {item.label}
                </Link>
              ))}
              <div className="bg-line my-3 h-px" />
              <Link
                href="/favorites"
                className="text-ink-2 hover:bg-surface rounded-xl px-3 py-3 text-base"
              >
                Saved homes
              </Link>
              <Link
                href="/compare"
                className="text-ink-2 hover:bg-surface rounded-xl px-3 py-3 text-base"
              >
                Compare
              </Link>
              <Link
                href="/mortgage"
                className="text-ink-2 hover:bg-surface rounded-xl px-3 py-3 text-base"
              >
                Mortgage calculator
              </Link>
              {user && user.role !== "consumer" ? (
                <Link
                  href="/pro"
                  className="text-ink-2 hover:bg-surface rounded-xl px-3 py-3 text-base"
                >
                  Pro workspace
                </Link>
              ) : null}
              {user?.role === "admin" ? (
                <Link
                  href="/admin"
                  className="text-ink-2 hover:bg-surface rounded-xl px-3 py-3 text-base"
                >
                  Admin panel
                </Link>
              ) : null}
            </nav>
            {!user ? (
              <div className="mt-auto grid gap-2">
                <Link
                  href="/register"
                  className="bg-brand-600 rounded-full py-3 text-center font-medium text-white"
                >
                  Join free
                </Link>
                <Link
                  href="/login"
                  className="border-line bg-surface rounded-full border py-3 text-center font-medium"
                >
                  Sign in
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
