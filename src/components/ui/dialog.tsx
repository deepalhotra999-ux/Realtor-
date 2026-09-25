"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-ink/40 absolute inset-0 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "animate-fade-up bg-surface shadow-pop relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl sm:max-w-lg sm:rounded-3xl",
          className,
        )}
      >
        <div className="border-line flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hover:bg-paper inline-flex size-9 items-center justify-center rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="border-line flex items-center justify-between gap-3 border-t px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
