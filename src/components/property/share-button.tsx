"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled */
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      className="border-line bg-surface hover:border-line-strong inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition"
    >
      {copied ? <Check className="text-brand-600 size-4" /> : <Share2 className="size-4" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
