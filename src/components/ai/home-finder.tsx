"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowRight, ArrowUp, Check, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { homeFinderAction } from "@/server/actions/ai";
import type { FinderResponse, FinderTurn } from "@/server/ai/features";
import { formatPrice } from "@/lib/format";
import { ListingFacts } from "@/components/listing/listing-card";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STARTERS = [
  "We're a family of four looking for a 3+ bedroom house in Raleigh under $550k with a yard",
  "1 bedroom rental in Seattle under $2,600, pet friendly, with in-unit laundry",
  "Modern condo in Denver with a gym and a balcony, around $450k",
  "I work from home — need an office and a garage in Nashville, up to $700k",
];

export function HomeFinder() {
  const [turns, setTurns] = useState<FinderTurn[]>([]);
  const [result, setResult] = useState<FinderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || pending) return;
    const next: FinderTurn[] = [...turns, { role: "user", content: t }];
    setTurns(next);
    setValue("");
    setError(null);
    start(async () => {
      const res = await homeFinderAction(next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
      setTurns([...next, { role: "assistant", content: res.data.reply }]);
      requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
      );
    });
  };

  const reset = () => {
    setTurns([]);
    setResult(null);
    setError(null);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,440px)_1fr]">
      {/* Conversation */}
      <div className="border-line bg-surface shadow-card flex min-h-[560px] flex-col rounded-3xl border lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]">
        <div className="border-line flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-brand-600 flex size-9 items-center justify-center rounded-xl text-white">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="font-semibold">Home Finder</p>
              <p className="text-muted text-xs">
                {result?.provider && result.provider !== "rules"
                  ? `Local model: ${result.provider}`
                  : "Grounded in listing data"}
              </p>
            </div>
          </div>
          {turns.length ? (
            <button
              type="button"
              onClick={reset}
              className="text-muted hover:bg-paper hover:text-ink inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" /> Start over
            </button>
          ) : null}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="bg-paper max-w-[90%] rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed">
            Hi! Describe the home you&apos;re picturing — where, your budget, and your must-haves.
            I&apos;ll find matches and show exactly why each one fits.
          </div>
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                t.role === "user"
                  ? "bg-ink ml-auto rounded-tr-md text-white"
                  : "bg-paper rounded-tl-md",
              )}
            >
              {t.content}
            </div>
          ))}
          {pending ? (
            <div
              className="bg-paper flex w-fit gap-1 rounded-2xl px-4 py-3.5"
              aria-label="Thinking"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="bg-subtle size-2 animate-bounce rounded-full"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          ) : null}
          {error ? (
            <p className="bg-clay-50 text-clay-600 flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <TriangleAlert className="size-4" /> {error}
            </p>
          ) : null}
          {turns.length === 0 ? (
            <div className="space-y-2 pt-2">
              <p className="text-muted text-xs font-medium">Try one of these</p>
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="border-line text-ink-2 hover:border-brand-300 hover:bg-brand-50/50 block w-full rounded-2xl border px-4 py-3 text-left text-sm transition"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {result?.chips.length ? (
          <div className="border-line flex flex-wrap gap-1.5 border-t px-5 py-3">
            {result.chips.map((c) => (
              <span
                key={c}
                className="bg-brand-50 text-brand-700 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize"
              >
                <Check className="size-3" />
                {c}
              </span>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(value);
          }}
          className="border-line flex items-end gap-2 border-t p-3"
        >
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(value);
              }
            }}
            rows={2}
            maxLength={1000}
            placeholder={result?.missing.length ? "Add more detail…" : "Describe your ideal home…"}
            aria-label="Message"
            className="border-line bg-paper focus:border-brand-400 focus:bg-surface min-h-12 flex-1 resize-none rounded-2xl border px-4 py-3 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={pending || !value.trim()}
            aria-label="Send"
            className="bg-brand-600 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
          >
            <ArrowUp className="size-5" />
          </button>
        </form>
      </div>

      {/* Matches */}
      <div>
        {result && result.results.length ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl">Your top matches</h2>
                <p className="text-muted text-sm">
                  {result.total} homes considered
                  {result.preferences.placeLabel
                    ? ` around ${result.preferences.placeLabel.split(",")[0]}`
                    : ""}{" "}
                  · ranked by fit
                </p>
              </div>
              <ButtonLink href={result.searchHref} variant="secondary">
                See all on map <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
            <div className="mt-6 space-y-4">
              {result.results.map(({ listing: l, match }) => (
                <Link
                  key={l.id}
                  href={`/homes/${l.slug}`}
                  className="group border-line bg-surface shadow-card hover:shadow-lift grid grid-cols-1 overflow-hidden rounded-3xl border transition sm:grid-cols-[260px_1fr]"
                >
                  <div className="bg-paper-2 relative aspect-[4/3] sm:aspect-auto">
                    {l.photoUrl ? (
                      <img
                        src={l.photoUrl}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : null}
                    <span
                      className={cn(
                        "absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm",
                        match.score >= 80
                          ? "bg-brand-600 text-white"
                          : match.score >= 60
                            ? "text-brand-700 bg-white"
                            : "text-ink-2 bg-white",
                      )}
                    >
                      {match.score}% match
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="tabular text-xl font-semibold">
                      {formatPrice(l.price, l.listingType)}
                    </p>
                    <ListingFacts l={l} className="mt-1" />
                    <p className="text-muted mt-1 text-sm">
                      {l.street}, {l.neighborhood}, {l.city}
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {match.reasons.length ? (
                        <ul className="space-y-1.5">
                          {match.reasons.map((r) => (
                            <li key={r} className="text-ink-2 flex gap-2 text-sm">
                              <Check className="text-brand-600 mt-0.5 size-4 shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {match.tradeoffs.length ? (
                        <ul className="space-y-1.5">
                          {match.tradeoffs.map((r) => (
                            <li key={r} className="text-muted flex gap-2 text-sm">
                              <TriangleAlert className="text-gold-500 mt-0.5 size-4 shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-muted mt-6 text-xs">
              Match scores are computed from your stated preferences and listing facts. Reasons are
              never generated by the model.
            </p>
          </>
        ) : (
          <div className="border-line-strong bg-surface/50 flex h-full min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed p-10 text-center">
            <Sparkles className="text-brand-400 size-8" />
            <p className="font-display mt-4 text-2xl">Matches appear here</p>
            <p className="text-muted mt-2 max-w-sm text-sm">
              Each home gets a transparent fit score with the reasons it matches — and the
              trade-offs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
