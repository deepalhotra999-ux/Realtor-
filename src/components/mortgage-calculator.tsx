"use client";

import { useMemo, useState } from "react";
import {
  affordablePrice,
  amortizationByYear,
  calculateMortgage,
  DEFAULT_RATE_PCT,
} from "@/lib/mortgage";
import { formatPrice } from "@/lib/format";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        {prefix ? (
          <span className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm">
            {prefix}
          </span>
        ) : null}
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(prefix && "pl-7", suffix && "pr-12", "tabular")}
        />
        {suffix ? (
          <span className="text-muted pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

/** Balance-over-time area chart, single series, crosshair tooltip. */
function BalanceChart({ loan, rate, term }: { loan: number; rate: number; term: number }) {
  const data = useMemo(() => amortizationByYear(loan, rate, term), [loan, rate, term]);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640,
    H = 220,
    P = { l: 56, r: 12, t: 12, b: 28 };
  const max = Math.max(loan, 1);
  const x = (i: number) => P.l + (i / Math.max(1, data.length)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const pts = [[x(0), y(loan)], ...data.map((d, i) => [x(i + 1), y(d.balance)])];
  const line = pts
    .map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((max * f) / 1000) * 1000);
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Remaining loan balance by year"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - P.l) / (W - P.l - P.r)) * data.length) - 1;
          setHover(i >= 0 && i < data.length ? i : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text
              x={P.l - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--color-muted)"
              className="tabular"
            >
              ${Math.round(t / 1000)}K
            </text>
          </g>
        ))}
        {[0, Math.round(term / 2), term].map((yr) => (
          <text
            key={yr}
            x={x(yr)}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-muted)"
          >
            Yr {yr}
          </text>
        ))}
        <path
          d={`${line} L${x(data.length)},${y(0)} L${x(0)},${y(0)} Z`}
          fill="var(--color-brand-600)"
          opacity={0.1}
        />
        <path
          d={line}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover !== null ? (
          <>
            <line
              x1={x(hover + 1)}
              x2={x(hover + 1)}
              y1={P.t}
              y2={H - P.b}
              stroke="var(--color-ink)"
              strokeWidth={1}
              opacity={0.4}
            />
            <circle
              cx={x(hover + 1)}
              cy={y(data[hover].balance)}
              r={5}
              fill="var(--color-brand-600)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          </>
        ) : null}
      </svg>
      {h ? (
        <div className="border-line bg-surface shadow-card pointer-events-none absolute top-2 right-2 rounded-xl border px-3 py-2 text-xs">
          <p className="tabular text-ink font-semibold">{formatPrice(Math.round(h.balance))}</p>
          <p className="text-muted">Balance after year {h.year}</p>
          <p className="text-muted tabular mt-1">
            Year interest {formatPrice(Math.round(h.interestPaid))}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function MortgageCalculator({ initialPrice = 550_000 }: { initialPrice?: number }) {
  const [price, setPrice] = useState(initialPrice);
  const [down, setDown] = useState(Math.round(initialPrice * 0.2));
  const [rate, setRate] = useState(DEFAULT_RATE_PCT);
  const [term, setTerm] = useState(30);
  const [tax, setTax] = useState(Math.round(initialPrice * 0.011));
  const [insurance, setInsurance] = useState(Math.round(initialPrice * 0.0035));
  const [hoa, setHoa] = useState(0);
  const [income, setIncome] = useState(140_000);
  const [debts, setDebts] = useState(400);

  const b = calculateMortgage({
    price,
    downPayment: down,
    ratePct: rate,
    termYears: term,
    taxAnnual: tax,
    insuranceAnnual: insurance,
    hoaMonthly: hoa,
  });
  const afford = affordablePrice({
    annualIncome: income,
    monthlyDebts: debts,
    downPayment: down,
    ratePct: rate,
    termYears: term,
    hoaMonthly: hoa,
  });
  const dti = income > 0 ? ((b.total + debts) / (income / 12)) * 100 : 0;
  const parts = [
    { label: "Principal & interest", v: b.principalAndInterest, c: "var(--color-brand-600)" },
    { label: "Property tax", v: b.tax, c: "var(--color-brand-300)" },
    { label: "Insurance", v: b.insurance, c: "var(--color-gold-500)" },
    { label: "HOA", v: b.hoa, c: "var(--color-clay-500)" },
    { label: "PMI", v: b.pmi, c: "var(--color-sky-600)" },
  ].filter((p) => p.v > 0.5);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
      <div className="border-line bg-surface shadow-card space-y-4 rounded-3xl border p-6">
        <NumberField label="Home price" prefix="$" value={price} step={5000} onChange={setPrice} />
        <NumberField
          label="Down payment"
          prefix="$"
          value={down}
          step={1000}
          onChange={setDown}
          hint={`${price ? ((down / price) * 100).toFixed(1) : 0}% of price`}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Interest rate"
            suffix="%"
            value={rate}
            step={0.125}
            onChange={setRate}
          />
          <Field label="Term">
            <div className="grid grid-cols-3 gap-1">
              {[15, 20, 30].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTerm(t)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium",
                    term === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line",
                  )}
                >
                  {t}y
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Property tax / yr"
            prefix="$"
            value={tax}
            step={100}
            onChange={setTax}
          />
          <NumberField
            label="Insurance / yr"
            prefix="$"
            value={insurance}
            step={100}
            onChange={setInsurance}
          />
        </div>
        <NumberField label="HOA / month" prefix="$" value={hoa} step={25} onChange={setHoa} />
      </div>

      <div className="space-y-6">
        <div className="border-line bg-surface shadow-card rounded-3xl border p-6">
          <p className="text-muted text-sm">Estimated monthly payment</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">
            {formatPrice(Math.round(b.total))}
          </p>
          <div
            className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label="Payment breakdown"
          >
            {parts.map((p) => (
              <div key={p.label} style={{ width: `${(p.v / b.total) * 100}%`, background: p.c }} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {parts.map((p) => (
              <li
                key={p.label}
                className="bg-paper flex items-center justify-between rounded-xl px-3 py-2 text-sm"
              >
                <span className="text-ink-2 flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: p.c }} />
                  {p.label}
                </span>
                <span className="tabular font-medium">{formatPrice(Math.round(p.v))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">Remaining balance</p>
            <BalanceChart loan={b.loanAmount} rate={rate} term={term} />
            <p className="text-muted tabular mt-1 text-xs">
              Loan {formatPrice(Math.round(b.loanAmount))} · total interest{" "}
              {formatPrice(Math.round(b.totalInterest))} over {term} years
            </p>
          </div>
        </div>

        <div className="border-line bg-surface shadow-card rounded-3xl border p-6">
          <h2 className="font-display text-2xl">How much can I afford?</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              label="Gross annual income"
              prefix="$"
              value={income}
              step={5000}
              onChange={setIncome}
            />
            <NumberField
              label="Other monthly debts"
              prefix="$"
              value={debts}
              step={50}
              onChange={setDebts}
            />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-brand-50 rounded-2xl p-4">
              <p className="text-brand-700 text-sm">Comfortable price (36% DTI)</p>
              <p className="text-brand-800 mt-1 text-3xl font-semibold">{formatPrice(afford)}</p>
            </div>
            <div className={cn("rounded-2xl p-4", dti > 43 ? "bg-clay-50" : "bg-paper")}>
              <p className="text-muted text-sm">Debt-to-income at this price</p>
              <p className={cn("mt-1 text-3xl font-semibold", dti > 43 && "text-clay-600")}>
                {dti.toFixed(0)}%
              </p>
              <p className="text-muted mt-1 text-xs">
                {dti > 43
                  ? "Above the common 43% lending limit"
                  : dti > 36
                    ? "Stretch — above the 36% guideline"
                    : "Within typical guidelines"}
              </p>
            </div>
          </div>
          <p className="text-muted mt-4 text-xs">
            Educational estimate only — not a loan offer or financial advice. Rates shown are
            illustrative defaults.
          </p>
        </div>
      </div>
    </div>
  );
}
