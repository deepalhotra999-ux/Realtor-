"use client";

import { useState } from "react";
import { calculateMortgage, DEFAULT_RATE_PCT } from "@/lib/mortgage";
import { formatPrice } from "@/lib/format";
import { Label } from "@/components/ui/input";

const SEGMENTS = [
  { key: "principalAndInterest", label: "Principal & interest", color: "var(--color-brand-600)" },
  { key: "tax", label: "Property tax", color: "var(--color-brand-300)" },
  { key: "insurance", label: "Home insurance", color: "var(--color-gold-500)" },
  { key: "hoa", label: "HOA dues", color: "var(--color-clay-500)" },
  { key: "pmi", label: "Mortgage insurance", color: "var(--color-sky-600)" },
] as const;

export function MonthlyCost({
  price,
  taxAnnual,
  hoaMonthly,
}: {
  price: number;
  taxAnnual: number | null;
  hoaMonthly: number | null;
}) {
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(DEFAULT_RATE_PCT);
  const [term, setTerm] = useState(30);
  const b = calculateMortgage({
    price,
    downPayment: (price * downPct) / 100,
    ratePct: rate,
    termYears: term,
    taxAnnual: taxAnnual ?? undefined,
    hoaMonthly: hoaMonthly ?? 0,
  });
  const parts = SEGMENTS.filter((s) => b[s.key] > 0.5);

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="text-muted text-sm">Estimated monthly payment</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight">
          {formatPrice(Math.round(b.total))}
        </p>
        <div
          className="bg-paper-2 mt-5 flex h-3 overflow-hidden rounded-full"
          role="img"
          aria-label="Monthly cost breakdown"
        >
          {parts.map((s) => (
            <div
              key={s.key}
              style={{ width: `${(b[s.key] / b.total) * 100}%`, background: s.color }}
            />
          ))}
        </div>
        <ul className="mt-5 space-y-2.5">
          {parts.map((s) => (
            <li key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-ink-2 flex items-center gap-2.5">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="tabular font-medium">{formatPrice(Math.round(b[s.key]))}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted mt-4 text-xs">
          Estimate only. {taxAnnual ? "Uses the listed property tax." : "Tax estimated at 1.1%/yr."}{" "}
          Insurance estimated at 0.35%/yr. Not a loan offer.
        </p>
      </div>
      <div className="bg-paper space-y-5 rounded-2xl p-5">
        <div>
          <div className="flex justify-between">
            <Label htmlFor="mc-down">Down payment</Label>
            <span className="tabular text-sm font-medium">
              {downPct}% · {formatPrice(Math.round((price * downPct) / 100))}
            </span>
          </div>
          <input
            id="mc-down"
            type="range"
            min={3}
            max={50}
            step={1}
            value={downPct}
            onChange={(e) => setDownPct(Number(e.target.value))}
            className="accent-brand-600 w-full"
          />
        </div>
        <div>
          <div className="flex justify-between">
            <Label htmlFor="mc-rate">Interest rate</Label>
            <span className="tabular text-sm font-medium">{rate.toFixed(2)}%</span>
          </div>
          <input
            id="mc-rate"
            type="range"
            min={2}
            max={10}
            step={0.125}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="accent-brand-600 w-full"
          />
        </div>
        <div>
          <Label>Loan term</Label>
          <div className="grid grid-cols-3 gap-2">
            {[15, 20, 30].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={`rounded-xl border py-2 text-sm font-medium transition ${term === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-2"}`}
              >
                {t} yr
              </button>
            ))}
          </div>
        </div>
        <p className="text-muted text-xs">
          Loan amount {formatPrice(Math.round(b.loanAmount))} · total interest{" "}
          {formatPrice(Math.round(b.totalInterest))}
        </p>
      </div>
    </div>
  );
}
