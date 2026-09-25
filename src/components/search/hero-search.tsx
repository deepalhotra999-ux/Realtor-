"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Building2, Home, MapPin, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { looksLikeNaturalLanguage } from "@/lib/ai/nl-parser";

type Suggestion = { kind: "place" | "listing"; label: string; sublabel?: string; href: string };

export function useSuggestions(query: string) {
  const [items, setItems] = useState<Suggestion[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || looksLikeNaturalLanguage(q)) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { suggestions: Suggestion[] }) => setItems(d.suggestions))
        .catch(() => {});
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  const q = query.trim();
  return q.length < 2 || looksLikeNaturalLanguage(q) ? [] : items;
}

export function HeroSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<"sale" | "rent">("sale");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useSuggestions(query);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const nl = looksLikeNaturalLanguage(query);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const withMode = (href: string) =>
    mode === "rent" && !href.includes("type=") && href.startsWith("/search")
      ? `${href}&type=rent`
      : href;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (active >= 0 && suggestions[active]) return router.push(withMode(suggestions[active].href));
    if (!q) return router.push(mode === "rent" ? "/search?type=rent" : "/search");
    const params = new URLSearchParams();
    if (nl) params.set("q", q);
    else if (suggestions[0]?.kind === "place") return router.push(withMode(suggestions[0].href));
    else params.set("place", q);
    if (mode === "rent") params.set("type", "rent");
    router.push(`/search?${params}`);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-2xl">
      <div className="mb-3 inline-flex rounded-full bg-white/70 p-1 shadow-sm backdrop-blur">
        {(["sale", "rent"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition",
              mode === m ? "bg-ink text-white shadow-sm" : "text-ink-2 hover:text-ink",
            )}
          >
            {m === "sale" ? <Home className="size-3.5" /> : <Building2 className="size-3.5" />}
            {m === "sale" ? "Buy" : "Rent"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} role="search" className="relative">
        <div className="border-line bg-surface shadow-lift focus-within:ring-brand-100 flex items-center gap-2 rounded-full border p-2 pl-5 focus-within:ring-4">
          {nl ? (
            <Sparkles className="text-brand-600 size-5 shrink-0" />
          ) : (
            <Search className="text-muted size-5 shrink-0" />
          )}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, suggestions.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, -1));
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="City, neighborhood, ZIP — or describe your dream home"
            aria-label="Search homes"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open && suggestions.length > 0}
            role="combobox"
            className="text-ink placeholder:text-subtle h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition"
          >
            {nl ? "Ask AI" : "Search"}
          </button>
        </div>
        {open && suggestions.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="animate-fade-up border-line bg-surface shadow-pop absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border p-1.5"
          >
            {suggestions.map((s, i) => (
              <li key={s.href} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => router.push(withMode(s.href))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                    i === active && "bg-paper",
                  )}
                >
                  <span className="bg-brand-50 text-brand-600 flex size-8 shrink-0 items-center justify-center rounded-full">
                    {s.kind === "place" ? (
                      <MapPin className="size-4" />
                    ) : (
                      <Home className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="text-ink block truncate text-sm font-medium">{s.label}</span>
                    {s.sublabel ? (
                      <span className="text-muted block truncate text-xs">{s.sublabel}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {nl && query.trim().length > 3 ? (
          <p className="text-brand-700 mt-2 flex items-center gap-1.5 pl-5 text-xs">
            <Sparkles className="size-3" /> We&apos;ll turn that into filters — you can adjust them
            after.
          </p>
        ) : null}
      </form>
    </div>
  );
}
