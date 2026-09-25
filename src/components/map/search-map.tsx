"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { createMaplibreMap, dotHtml, escapeHtml, fitPoints, pillHtml } from "./maplibre";

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
/** Below this zoom, pins render as dots so dense areas stay readable. */
const PRICE_PIN_ZOOM = 13;

function popupHtml(p: MapPin): string {
  const price = `${escapeHtml(formatCompactPrice(p.price, p.listingType))}${p.listingType === "rent" ? "/mo" : ""}`;
  const beds = p.beds !== null ? ` · ${p.beds === 0 ? "Studio" : `${p.beds} bd`}` : "";
  const home = `/homes/${encodeURIComponent(p.slug)}`;
  return (
    `<div class="dw-popup"><a href="${home}" class="dw-popup-title">${price}${beds}</a>` +
    `<div class="dw-popup-row"><a href="${home}" class="dw-popup-link">View home →</a>` +
    `<a href="${directionsUrl(p.lat, p.lng)}" target="_blank" rel="noreferrer" class="dw-popup-link">Directions ↗</a></div></div>`
  );
}

interface PinHandle {
  marker: maplibregl.Marker;
  el: HTMLDivElement;
  setActive: (active: boolean) => void;
}

function PriceLegend({ mode, pins }: { mode: PinPriceMode; pins: MapPin[] }) {
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
    <div className="bg-surface/95 shadow-card absolute bottom-6 left-3 z-10 rounded-2xl px-3.5 py-3 backdrop-blur">
      <p className="text-ink text-xs font-semibold">
        {mode === "ppsf" ? "Price per sqft" : "Price"} · median {fmt(stats.med!)}
      </p>
      <div className="mt-2 space-y-1">
        {(["low", "mid", "high"] as const).map((b) => (
          <div key={b} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: bucketColor(b) }} aria-hidden />
            <span className="text-muted text-[11px]">{PRICE_BUCKET_LABELS[b]}</span>
          </div>
        ))}
      </div>
      <p className="text-subtle mt-1.5 text-[10px]">Colored vs. homes on this map</p>
    </div>
  );
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, PinHandle>>(new Map());
  const [mode, setMode] = useState<PinPriceMode>("price");
  const [zoom, setZoom] = useState(fallbackCenter.zoom);
  const onHoverRef = useRef(onHover);
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => {
    onHoverRef.current = onHover;
    onBoundsChangeRef.current = onBoundsChange;
  });
  // Mount-time props for the one-shot initial fit.
  const mountArgs = useRef({ pins, bbox, fallbackCenter });

  const buckets = useMemo(() => {
    const values = pins
      .map((p) => pinPriceValue(p, mode))
      .filter((v): v is number => v !== null);
    const { p33, p67 } = priceCutoffs(values);
    return new Map(pins.map((p) => [p.id, bucketFor(pinPriceValue(p, mode), p33, p67)]));
  }, [pins, mode]);

  const dense = zoom < PRICE_PIN_ZOOM && pins.length > 25;

  // Initialise the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { pins: initialPins, bbox: initialBbox, fallbackCenter: fc } = mountArgs.current;
    const map = createMaplibreMap(container, config, { lng: fc.lng, lat: fc.lat, zoom: fc.zoom });
    mapRef.current = map;
    const markers = markersRef.current;
    setZoom(map.getZoom());

    if (initialBbox) {
      map.fitBounds(
        [
          [initialBbox[0], initialBbox[1]],
          [initialBbox[2], initialBbox[3]],
        ],
        { animate: false },
      );
    } else if (initialPins.length > 0) {
      fitPoints(map, initialPins);
      if (map.getZoom() > 14) map.setZoom(14);
    }

    map.on("zoomend", () => setZoom(map.getZoom()));

    let first = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    map.on("moveend", () => {
      // Ignore the first moveend — it is the programmatic initial fit.
      if (first) {
        first = false;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const b = map.getBounds();
        onBoundsChangeRef.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }, 350);
    });

    return () => {
      if (timer) clearTimeout(timer);
      for (const handle of markers.values()) handle.marker.remove();
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers imperatively whenever pins, buckets, mode or density change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const handle of markersRef.current.values()) handle.marker.remove();
    markersRef.current.clear();

    for (const p of pins) {
      const bucket: PriceBucket = buckets.get(p.id) ?? "na";
      const bg = bucketColor(bucket);
      const el = document.createElement("div");

      const render = (active: boolean) => {
        if (dense) {
          el.innerHTML = dotHtml(active ? ACTIVE_BG : bg);
          return;
        }
        const sub =
          mode === "ppsf"
            ? (() => {
                const v = pinPriceValue(p, "ppsf");
                return v !== null ? `$${Math.round(v)}/ft²` : null;
              })()
            : null;
        el.innerHTML = pillHtml(
          escapeHtml(formatCompactPrice(p.price, p.listingType)),
          sub ? escapeHtml(sub) : null,
          active ? ACTIVE_BG : bg,
          active,
        );
      };
      render(false);

      const marker = new maplibregl.Marker({ element: el, anchor: dense ? "center" : "bottom" })
        .setLngLat([p.lng, p.lat])
        .setPopup(
          new maplibregl.Popup({ closeButton: false, offset: 14, maxWidth: "240px" }).setHTML(
            popupHtml(p),
          ),
        )
        .addTo(map);

      el.addEventListener("mouseenter", () => onHoverRef.current?.(p.id));
      el.addEventListener("mouseleave", () => onHoverRef.current?.(null));

      const handle: PinHandle = {
        marker,
        el,
        setActive: (active: boolean) => {
          render(active);
          el.style.zIndex = active ? "1000" : p.isFeatured ? "500" : "";
        },
      };
      if (p.isFeatured) el.style.zIndex = "500";
      markersRef.current.set(p.id, handle);
    }
  }, [pins, buckets, mode, dense]);

  // Sync the hovered/active pin without rebuilding all markers.
  useEffect(() => {
    for (const [id, handle] of markersRef.current) handle.setActive(id === hoveredId);
  }, [hoveredId]);

  return (
    <div className="relative size-full overflow-hidden">
      <div ref={containerRef} className="size-full" role="application" aria-label="Map of listings" />
      <div className="absolute top-3 right-3 z-10 flex overflow-hidden rounded-full border border-black/10 bg-white shadow-lg">
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
    </div>
  );
}
