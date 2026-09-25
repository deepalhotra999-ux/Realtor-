"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { MapConfig } from "@/providers/map/types";
import type { MapPin } from "@/providers/search/types";
import type { BBox } from "@/lib/search/query";
import { formatCompactPrice } from "@/lib/format";

export interface SearchMapProps {
  config: MapConfig;
  pins: MapPin[];
  bbox?: BBox;
  fallbackCenter: { lat: number; lng: number; zoom: number };
  hoveredId: string | null;
  onHover?: (id: string | null) => void;
  onBoundsChange?: (bbox: BBox) => void;
}

function pinIcon(pin: MapPin, active: boolean) {
  const label = formatCompactPrice(pin.price, pin.listingType);
  const bg = active ? "#16211d" : pin.isFeatured ? "#0b4a3d" : "#ffffff";
  const fg = active || pin.isFeatured ? "#ffffff" : "#16211d";
  return L.divIcon({
    className: "dw-pin",
    html: `<div style="transform:translate(-50%,-100%);display:inline-flex;align-items:center;white-space:nowrap;padding:3px 9px;border-radius:999px;background:${bg};color:${fg};font:600 12px/1.4 var(--font-sans);box-shadow:0 2px 8px rgb(0 0 0 / .22);border:1px solid rgb(0 0 0 / .08);${active ? "scale:1.12;" : ""}">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function dotIcon(pin: MapPin) {
  const color = pin.isFeatured ? "#c3962b" : "#0f5c4c";
  return L.divIcon({
    className: "dw-pin",
    html: `<div style="transform:translate(-50%,-50%);width:12px;height:12px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .35)"></div>`,
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
}: Pick<SearchMapProps, "pins" | "hoveredId" | "onHover">) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: (e) => setZoom(e.target.getZoom()) });
  const icons = useMemo(
    () =>
      new Map(
        pins.map((p) => [
          p.id,
          { normal: pinIcon(p, false), active: pinIcon(p, true), dot: dotIcon(p) },
        ]),
      ),
    [pins],
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
        </Popup>
      </Marker>
    );
  });
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
      <Pins pins={pins} hoveredId={hoveredId} onHover={onHover} />
    </MapContainer>
  );
}
