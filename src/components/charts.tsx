"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import { formatCompactPrice } from "@/lib/format";

export type ChartUnit = "count" | "usd" | "usdRent";

function formatter(unit: ChartUnit) {
  if (unit === "usd") return (n: number) => formatCompactPrice(Math.round(n));
  if (unit === "usdRent") return (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  return (n: number) => Math.round(n).toLocaleString("en-US");
}

/**
 * Small, dependency-free SVG charts. Single-series by design (the title names
 * the series), brand hue marks, recessive hairline grid, per-mark / crosshair
 * tooltips, and a table view so no value is hover-gated.
 */

export interface Datum {
  label: string;
  value: number;
  /** Tooltip / table label (defaults to `label`). */
  detail?: string;
}

const W = 640;
const H = 240;
const PAD = { l: 52, r: 12, t: 16, b: 34 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function TableView({
  data,
  valueLabel,
  format,
}: {
  data: Datum[];
  valueLabel: string;
  format: (n: number) => string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted text-left text-xs">
          <th className="py-2 font-medium">Range</th>
          <th className="py-2 text-right font-medium">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.label} className="border-line border-t">
            <td className="py-2">{d.detail ?? d.label}</td>
            <td className="tabular py-2 text-right">{format(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Frame({
  title,
  subtitle,
  children,
  table,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  table: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="border-line bg-surface shadow-card rounded-3xl border p-5">
      <figcaption className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          {subtitle ? <p className="text-muted text-xs">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          aria-pressed={showTable}
          className="border-line text-muted hover:text-ink inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
        >
          <Table2 className="size-3.5" /> {showTable ? "Chart" : "Table"}
        </button>
      </figcaption>
      <div className="mt-3">{showTable ? table : children}</div>
    </figure>
  );
}

export function ColumnChart({
  title,
  subtitle,
  data,
  valueLabel,
  unit = "count",
}: {
  title: string;
  subtitle?: string;
  data: Datum[];
  valueLabel: string;
  unit?: ChartUnit;
}) {
  const format = formatter(unit);
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const band = (W - PAD.l - PAD.r) / Math.max(1, data.length);
  const bw = Math.min(24, band - 2);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const labelEvery = Math.ceil(data.length / 6);

  return (
    <Frame
      title={title}
      subtitle={subtitle}
      table={<TableView data={data} valueLabel={valueLabel} format={format} />}
    >
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 8}
                y={y(t) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-muted)"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.l + band * i + band / 2;
            const top = y(d.value);
            const h = Math.max(0, y(0) - top);
            const r = Math.min(4, h);
            return (
              <g
                key={d.label}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                aria-label={`${d.detail ?? d.label}: ${format(d.value)}`}
              >
                <rect
                  x={PAD.l + band * i}
                  y={PAD.t}
                  width={band}
                  height={H - PAD.t - PAD.b}
                  fill="transparent"
                />
                {h > 0 ? (
                  <path
                    d={`M${cx - bw / 2},${y(0)} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${y(0)} Z`}
                    fill="var(--color-brand-600)"
                    opacity={active === null || active === i ? 1 : 0.55}
                  />
                ) : null}
                {i % labelEvery === 0 ? (
                  <text
                    x={cx}
                    y={H - 12}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--color-muted)"
                  >
                    {d.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {active !== null ? (
          <div className="border-line bg-surface shadow-card pointer-events-none absolute top-0 right-0 rounded-xl border px-3 py-2 text-xs">
            <p className="text-ink tabular font-semibold">{format(data[active].value)}</p>
            <p className="text-muted">{data[active].detail ?? data[active].label}</p>
          </div>
        ) : null}
      </div>
    </Frame>
  );
}

export function LineChart({
  title,
  subtitle,
  data,
  valueLabel,
  unit = "count",
}: {
  title: string;
  subtitle?: string;
  data: Datum[];
  valueLabel: string;
  unit?: ChartUnit;
}) {
  const format = formatter(unit);
  const [active, setActive] = useState<number | null>(null);
  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || hi || 1;
  const min = Math.max(0, lo - span * 0.25);
  const max = hi + span * 0.25;
  const x = (i: number) =>
    PAD.l + (data.length <= 1 ? 0.5 : i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const path = data
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(" ");
  const ticks = [min, (min + max) / 2, max];
  const last = data.length - 1;

  return (
    <Frame
      title={title}
      subtitle={subtitle}
      table={<TableView data={data} valueLabel={valueLabel} format={format} />}
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={title}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * last);
            setActive(Math.max(0, Math.min(last, i)));
          }}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 8}
                y={y(t) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-muted)"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => (
            <text
              key={d.label}
              x={x(i)}
              y={H - 12}
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-muted)"
            >
              {d.label}
            </text>
          ))}
          <path
            d={path}
            fill="none"
            stroke="var(--color-brand-600)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {data.length ? (
            <circle
              cx={x(last)}
              cy={y(data[last].value)}
              r={4}
              fill="var(--color-brand-600)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}
          {active !== null ? (
            <>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke="var(--color-ink)"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
              <circle
                cx={x(active)}
                cy={y(data[active].value)}
                r={5}
                fill="var(--color-brand-600)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </>
          ) : null}
        </svg>
        {active !== null ? (
          <div className="border-line bg-surface shadow-card pointer-events-none absolute top-0 right-0 rounded-xl border px-3 py-2 text-xs">
            <p className="text-ink tabular font-semibold">{format(data[active].value)}</p>
            <p className="text-muted">{data[active].detail ?? data[active].label}</p>
          </div>
        ) : null}
      </div>
    </Frame>
  );
}
