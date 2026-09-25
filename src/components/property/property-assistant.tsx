"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowUp, Info, Sparkles } from "lucide-react";
import { askPropertyAction } from "@/server/actions/ai";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  hoaMonthly: "HOA",
  taxAnnual: "property tax",
  features: "features",
  petsAllowed: "pet policy",
  deposit: "deposit",
  leaseTermMonths: "lease terms",
  availableFrom: "availability",
  status: "status",
  furnished: "furnishing",
  openHouses: "open houses",
  priceHistory: "price history",
  listedAt: "listing date",
  price: "price",
  sqft: "size",
  beds: "bedrooms",
  baths: "bathrooms",
  lotSqft: "lot size",
  yearBuilt: "year built",
  garageSpaces: "parking",
  stories: "stories",
  address: "address",
  agent: "listing agent",
  propertyType: "home type",
};
const sourceLabel = (k: string) =>
  SOURCE_LABELS[k] ??
  k
    .replace(/^facts\./, "")
    .replace(/([A-Z])/g, " $1")
    .toLowerCase();

type QA = {
  q: string;
  a: string;
  sources: string[];
  grounded: boolean;
  provider: string;
  error?: boolean;
};

export function PropertyAssistant({ slug, suggestions }: { slug: string; suggestions: string[] }) {
  const [items, setItems] = useState<QA[]>([]);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setValue("");
    start(async () => {
      const res = await askPropertyAction(slug, q);
      setItems((prev) => [
        ...prev,
        res.ok
          ? {
              q,
              a: res.data.answer,
              sources: res.data.sources,
              grounded: res.data.grounded,
              provider: res.data.provider,
            }
          : { q, a: res.error, sources: [], grounded: false, provider: "", error: true },
      ]);
      requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    });
  };

  return (
    <div className="border-brand-200 from-brand-50 to-surface rounded-3xl border bg-gradient-to-b p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="bg-brand-600 flex size-8 items-center justify-center rounded-xl text-white">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h2 className="font-semibold">Ask about this home</h2>
          <p className="text-muted text-xs">Answers come only from listing data — no guessing.</p>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="mt-5 max-h-96 space-y-4 overflow-y-auto pr-1">
          {items.map((it, i) => (
            <div key={i} className="space-y-2">
              <p className="bg-ink ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white">
                {it.q}
              </p>
              <div
                className={cn(
                  "max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-3 text-sm leading-relaxed",
                  it.error
                    ? "border-clay-100 bg-clay-50 text-clay-600"
                    : "border-line bg-surface text-ink",
                )}
              >
                {it.a}
                {!it.error ? (
                  <p className="text-muted mt-2 flex items-center gap-1 text-[11px]">
                    <Info className="size-3" />
                    {it.grounded
                      ? `From listing data: ${it.sources.map(sourceLabel).join(", ") || "listing facts"}`
                      : "Not in the listing data"}
                    {it.provider && it.provider !== "rules" ? ` · ${it.provider}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      ) : null}

      {pending ? (
        <p className="text-muted mt-4 animate-pulse text-sm">Checking the listing…</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            disabled={pending}
            className="border-line bg-surface text-ink-2 hover:border-brand-300 hover:text-brand-700 rounded-full border px-3 py-1.5 text-xs transition"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
        }}
        className="border-line bg-surface focus-within:ring-brand-100 mt-3 flex items-center gap-2 rounded-full border p-1.5 pl-4 focus-within:ring-4"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. What are the HOA dues?"
          maxLength={300}
          aria-label="Ask a question about this home"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          aria-label="Ask"
          className="bg-brand-600 hover:bg-brand-700 inline-flex size-9 items-center justify-center rounded-full text-white transition disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
