"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import type { MapConfig } from "@/providers/map/types";
import type { ListingType } from "@/lib/domain";
import { formatBaths, formatCompactPrice, formatNumber } from "@/lib/format";
import { directionsUrl } from "@/lib/map-pricing";
import { createMaplibreMap, escapeHtml, fitPoints, pillHtml } from "./maplibre";

export interface CompPin {
  id: string;
  slug: string;
  street: string;
  lat: number;
  lng: number;
  price: number;
  listingType: ListingType;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  distanceKm: number;
}

export interface CompsMapProps {
  config: MapConfig;
  subject: { lat: number; lng: number; price: number; listingType: ListingType; label: string };
  comps: CompPin[];
  activeId: string | null;
  onSelect?: (id: string | null) => void;
}

const ACTIVE_BG = "#16211d";
const CONNECTOR_LAYER_ID = "dw-comp-connectors";

const SUBJECT_PIN_SVG = `<div class="dw-marker"><svg width="36" height="46" viewBox="0 0 34 42"><path d="M17 41s15-13.6 15-24A15 15 0 0 0 2 17c0 10.4 15 24 15 24z" fill="#0f5c4c" stroke="#fff" stroke-width="2"/><text x="17" y="23" text-anchor="middle" font-family="system-ui" font-size="13" font-weight="700" fill="#fff">★</text></svg></div>`;

/** Green = cheaper than the subject home, amber = within ±5%, red = pricier. */
function compColor(price: number, subjectPrice: number): string {
  const ratio = price / subjectPrice;
  return ratio <= 0.95 ? "#15803d" : ratio >= 1.05 ? "#b91c1c" : "#b45309";
}

function compPopupHtml(c: CompPin): string {
  const price = `${escapeHtml(formatCompactPrice(c.price, c.listingType))}${c.listingType === "rent" ? "/mo" : ""}`;
  const ppsf = c.sqft ? ` · $${Math.round(c.price / c.sqft)}/ft²` : "";
  const home = `/homes/${encodeURIComponent(c.slug)}`;
  return (
    `<div class="dw-popup"><div class="dw-popup-title">${price}</div>` +
    `<div class="dw-popup-meta">${escapeHtml(c.street)} · ${c.distanceKm.toFixed(1)} km away</div>` +
    `<div class="dw-popup-meta">${c.beds === 0 ? "Studio" : `${c.beds ?? "—"} bd`} · ${escapeHtml(formatBaths(c.baths))} ba` +
    `${c.sqft ? ` · ${escapeHtml(formatNumber(c.sqft))} ft²` : ""}${ppsf}</div>` +
    `<div class="dw-popup-row"><a href="${home}" class="dw-popup-link">View home →</a>` +
    `<a href="${directionsUrl(c.lat, c.lng)}" target="_blank" rel="noreferrer" class="dw-popup-link">Directions ↗</a></div></div>`
  );
}

function subjectPopupHtml(subject: CompsMapProps["subject"]): string {
  return (
    `<div class="dw-popup"><div class="dw-popup-title">${escapeHtml(subject.label)}</div>` +
    `<div class="dw-popup-meta">${escapeHtml(formatCompactPrice(subject.price, subject.listingType))}` +
    `${subject.listingType === "rent" ? "/mo" : ""} · this home</div></div>`
  );
}

interface CompHandle {
  el: HTMLDivElement;
  setActive: (active: boolean) => void;
}

export default function CompsMap({ config, subject, comps, activeId, onSelect }: CompsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const handlesRef = useRef<Map<string, CompHandle>>(new Map());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });
  // Mount-time props for the one-shot initial fit.
  const mountArgs = useRef({ subject, comps });

  const renderPill = useMemo(
    () => (c: CompPin, active: boolean) =>
      pillHtml(
        escapeHtml(formatCompactPrice(c.price, c.listingType)),
        null,
        active ? ACTIVE_BG : compColor(c.price, subject.price),
        active,
      ),
    [subject.price],
  );

  // Initialise the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { subject: s, comps: initialComps } = mountArgs.current;
    const map = createMaplibreMap(container, config, { lng: s.lng, lat: s.lat, zoom: 13 });
    mapRef.current = map;
    const handles = handlesRef.current;
    map.scrollZoom.disable();

    // Subject marker.
    const subEl = document.createElement("div");
    subEl.innerHTML = SUBJECT_PIN_SVG;
    subEl.style.zIndex = "1000";
    new maplibregl.Marker({ element: subEl, anchor: "bottom" })
      .setLngLat([s.lng, s.lat])
      .setPopup(
        new maplibregl.Popup({ closeButton: false, offset: 18, maxWidth: "240px" }).setHTML(
          subjectPopupHtml(s),
        ),
      )
      .addTo(map);

    // Comp markers.
    const markers: maplibregl.Marker[] = [];
    for (const c of initialComps) {
      const el = document.createElement("div");
      el.innerHTML = renderPill(c, false);
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([c.lng, c.lat])
        .setPopup(
          new maplibregl.Popup({ closeButton: false, offset: 14, maxWidth: "260px" }).setHTML(
            compPopupHtml(c),
          ),
        )
        .addTo(map);
      markers.push(marker);
      el.addEventListener("mouseenter", () => onSelectRef.current?.(c.id));
      el.addEventListener("mouseleave", () => onSelectRef.current?.(null));
      el.addEventListener("click", () => onSelectRef.current?.(c.id));
      handlesRef.current.set(c.id, {
        el,
        setActive: (active: boolean) => {
          el.innerHTML = renderPill(c, active);
          el.style.zIndex = active ? "900" : "";
        },
      });
    }

    // Dashed connector lines from the subject home to each comp.
    const lines = initialComps.map((c) => [
      [s.lng, s.lat],
      [c.lng, c.lat],
    ]) as Array<Array<[number, number]>>;
    const addConnectors = () => {
      if (map.getSource(CONNECTOR_LAYER_ID) || lines.length === 0) return;
      map.addSource(CONNECTOR_LAYER_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: lines.map((coords) => ({
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords },
            properties: {},
          })),
        },
      });
      map.addLayer({
        id: CONNECTOR_LAYER_ID,
        type: "line",
        source: CONNECTOR_LAYER_ID,
        paint: {
          "line-color": "#0f5c4c",
          "line-width": 1.5,
          "line-opacity": 0.35,
          "line-dasharray": [5, 5],
        },
      });
    };
    if (map.isStyleLoaded()) addConnectors();
    else map.once("load", addConnectors);

    fitPoints(map, [{ lat: s.lat, lng: s.lng }, ...initialComps]);
    if (map.getZoom() > 14) map.setZoom(14);

    return () => {
      handles.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync the active comp without rebuilding markers.
  useEffect(() => {
    for (const [id, handle] of handlesRef.current) handle.setActive(id === activeId);
  }, [activeId]);

  return (
    <div className="relative size-full overflow-hidden">
      <div ref={containerRef} className="size-full" role="application" aria-label="Comparable homes map" />
    </div>
  );
}
