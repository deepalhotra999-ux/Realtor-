"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Navigation } from "lucide-react";
import type { MapConfig } from "@/providers/map/types";
import type { MapPin } from "@/providers/search/types";
import type { BBox } from "@/lib/search/query";
import { formatCompactPrice } from "@/lib/format";
import {
  bucketColor,
  bucketFor,
  directionsUrl,
  median,
  pinPriceValue,
  priceCutoffs,
  PRICE_BUCKET_LABELS,
  type PinPriceMode,
  type PriceBucket,
} from "@/lib/map-pricing";

export interface SearchMapProps {
  config: MapConfig;
  pins: MapPin[];
  bbox?: BBox;
  fallbackCenter: { lat: number; lng: number; zoom: number };
  hoveredId: string | null;
  onHover?: (id: string | null) => void;
  onBoundsChange?: (bbox: BBox) => void;
}

const ACTIVE_BG = "#16211d";

function pinIcon(pin: MapPin, active: boolean, bucket: PriceBucket, mode: PinPriceMode) {
  const label = formatCompactPrice(pin.price, pin.listingType);
  const bg = active ? ACTIVE_BG : bucketColor(bucket);
  const sub =
    mode === "ppsf"
      ? (() => {
          const v = pinPriceValue(pin, "ppsf");
          return v !== null ? `$${Math.round(v)}/ft²` : null;
        })()
      : null;
  return L.divIcon({
    className: "dw-pin",
    html: `<div style="transform:translate(-50%,-100%);display:inline-flex;flex-direction:column;align-items:center;white-space:nowrap;padding:3px 9px;border-radius:999px;background:${bg};color:#fff;font:600 12px/1.4 var(--font-sans);box-shadow:0 2px 8px rgb(0 0 0 / .22);border:1px solid rgb(0 0 0 / .08);${active ? "scale:1.12;" : ""}"><span>${label}</span>${sub ? `<span style="font:500 10px/1.2 var(--font-sans);opacity:.85">${sub}</span>` : ""}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function dotIcon(bucket: PriceBucket) {
  return L.divIcon({
    className: "dw-pin",
    html: `<div style="transform:translate(-50%,-50%);width:12px;height:12px;border-radius:999px;background:${bucketColor(bucket)};border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .35)"></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Below this zoom, pins render as dots so dense areas stay readable. */
const PRICE_PIN_ZOOM = 13;

function Pins({
  pins,
  hoveredId,
  onHover,
  mode,
  buckets,
}: Pick<SearchMapProps, "pins" | "hoveredId" | "onHover"> & {
  mode: PinPriceMode;
  buckets: Map<string, PriceBucket>;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: (e) => setZoom(e.target.getZoom()) });
  const icons = useMemo(
    () =>
      new Map(
        pins.map((p) => {
          const b = buckets.get(p.id) ?? "na";
          return [
            p.id,
            { normal: pinIcon(p, false, b, mode), active: pinIcon(p, true, b, mode), dot: dotIcon(b) },
          ];
        }),
      ),
    [pins, buckets, mode],
  );
  const dense = zoom < PRICE_PIN_ZOOM && pins.length > 25;
  return pins.map((p) => {
    const set = icons.get(p.id)!;
    const active = hoveredId === p.id;
    return (
      <Marker
        key={p.id}
        position={[p.lat, p.lng]}
        icon={active ? set.active : dense ? set.dot : set.normal}
        zIndexOffset={active ? 1000 : p.isFeatured ? 100 : 0}
        eventHandlers={{ mouseover: () => onHover?.(p.id), mouseout: () => onHover?.(null) }}
      >
        <Popup closeButton={false} offset={[0, dense ? -6 : -28]}>
          <Link href={`/homes/${p.slug}`} className="text-ink! block text-sm font-semibold">
            {formatCompactPrice(p.price, p.listingType)}
            {p.listingType === "rent" ? "/mo" : ""}
            {p.beds !== null ? ` · ${p.beds === 0 ? "Studio" : `${p.beds} bd`}` : ""}
            <span className="text-brand-600 mt-0.5 block text-xs font-medium">View home →</span>
          </Link>
          <a
            href={directionsUrl(p.lat, p.lng)}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-ink mt-1.5 inline-flex items-center gap-1 text-xs font-medium"
          >
            <Navigation className="size-3" /> Directions
          </a>
        </Popup>
      </Marker>
    );
  });
}

function PriceLegend({
  mode,
  pins,
}: {
  mode: PinPriceMode;
  pins: MapPin[];
}) {
  const stats = useMemo(() => {
    const values = pins
      .map((p) => pinPriceValue(p, mode))
      .filter((v): v is number => v !== null);
    if (!values.length) return null;
    const { p33, p67 } = priceCutoffs(values);
    return { med: median(values), p33, p67, count: values.length };
  }, [pins, mode]);
  if (!stats) return null;
  const fmt =
    mode === "ppsf"
      ? (v: number) => `$${Math.round(v)}/ft²`
      : (v: number) => formatCompactPrice(Math.round(v), "sale");
  return (
    <div className="bg-surface/95 shadow-card absolute bottom-6 left-3 z-[500] rounded-2xl px-3.5 py-3 backdrop-blur">
      <p className="text-ink text-xs font-semibold">
        {mode === "ppsf" ? "Price per sqft" : "Price"} · median {fmt(stats.med!)}
      </p>
      <div className="mt-2 space-y-1">
        {(["low", "mid", "high"] as const).map((b) => (
          <div key={b} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: bucketColor(b) }}
              aria-hidden
            />
            <span className="text-muted text-[11px]">{PRICE_BUCKET_LABELS[b]}</span>
          </div>
        ))}
      </div>
      <p className="text-subtle mt-1.5 text-[10px]">Colored vs. homes on this map</p>
    </div>
  );
}

function FitOnce({
  bbox,
  pins,
  fallback,
}: {
  bbox?: BBox;
  pins: MapPin[];
  fallback: SearchMapProps["fallbackCenter"];
}) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (bbox)
      map.fitBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        { animate: false },
      );
    else if (pins.length)
      map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), {
        padding: [40, 40],
        maxZoom: 14,
        animate: false,
      });
    else map.setView([fallback.lat, fallback.lng], fallback.zoom, { animate: false });
  }, [map, bbox, pins, fallback]);
  return null;
}

function BoundsWatcher({ onChange }: { onChange?: (b: BBox) => void }) {
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMapEvents({
    moveend(e) {
      // Ignore the programmatic initial fit.
      if (!ready.current) {
        ready.current = true;
        return;
      }
      if (!onChange) return;
      const b = e.target.getBounds();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () => onChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]),
        350,
      );
    },
  });
  return null;
}

export default function SearchMap({
  config,
  pins,
  bbox,
  fallbackCenter,
  hoveredId,
  onHover,
  onBoundsChange,
}: SearchMapProps) {
  const [mode, setMode] = useState<PinPriceMode>("price");
  const buckets = useMemo(() => {
    const values = pins
      .map((p) => pinPriceValue(p, mode))
      .filter((v): v is number => v !== null);
    const { p33, p67 } = priceCutoffs(values);
    return new Map(pins.map((p) => [p.id, bucketFor(pinPriceValue(p, mode), p33, p67)]));
  }, [pins, mode]);

  return (
    <MapContainer
      center={[fallbackCenter.lat, fallbackCenter.lng]}
      zoom={fallbackCenter.zoom}
      className="size-full"
      zoomControl
      scrollWheelZoom
    >
      <TileLayer url={config.tileUrl} attribution={config.attribution} maxZoom={config.maxZoom} />
      <FitOnce bbox={bbox} pins={pins} fallback={fallbackCenter} />
      <BoundsWatcher onChange={onBoundsChange} />
      <Pins pins={pins} hoveredId={hoveredId} onHover={onHover} mode={mode} buckets={buckets} />
      <div className="absolute top-3 right-3 z-[500] flex overflow-hidden rounded-full border border-black/10 bg-white shadow-lg">
        {(["price", "ppsf"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`px-3 py-1.5 text-xs font-semibold transition ${
              mode === m ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5"
            }`}
          >
            {m === "price" ? "Price" : "$/sqft"}
          </button>
        ))}
      </div>
      <PriceLegend mode={mode} pins={pins} />
    </MapContainer>
  );
}
