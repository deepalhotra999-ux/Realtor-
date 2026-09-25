"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemePref = "system" | "light" | "dark";

const ORDER: ThemePref[] = ["system", "light", "dark"];
const LABELS: Record<ThemePref, string> = {
  system: "Theme: match system",
  light: "Theme: light",
  dark: "Theme: dark",
};

declare global {
  interface Window {
    __dwApplyTheme?: () => void;
  }
}

/** The inline script in app/layout.tsx mirrors the stored preference onto <html>. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme-pref"] });
  return () => observer.disconnect();
}
const getSnapshot = () =>
  (document.documentElement.dataset.themePref as ThemePref | undefined) ?? "system";
const getServerSnapshot = (): ThemePref => "system";

export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem("dw-theme", next);
        } catch {
          /* storage blocked: still switch for this page view */
          document.documentElement.dataset.themePref = next;
        }
        window.__dwApplyTheme?.();
      }}
      aria-label={`${LABELS[pref]}. Switch to ${next}.`}
      title={LABELS[pref]}
      className={cn(
        "text-ink-2 hover:bg-ink/5 hover:text-ink inline-flex size-10 items-center justify-center rounded-full transition",
        className,
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
