"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { Navigation } from "lucide-react";
import type { MapConfig } from "@/providers/map/types";
import type { ListingType } from "@/lib/domain";
import { formatBaths, formatCompactPrice, formatNumber } from "@/lib/format";
import { directionsUrl } from "@/lib/map-pricing";

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

function subjectIcon() {
  return L.divIcon({
    className: "dw-pin",
    html: `<div style="transform:translate(-50%,-100%)"><svg width="36" height="46" viewBox="0 0 34 42"><path d="M17 41s15-13.6 15-24A15 15 0 0 0 2 17c0 10.4 15 24 15 24z" fill="#0f5c4c" stroke="#fff" stroke-width="2"/><text x="17" y="23" text-anchor="middle" font-family="system-ui" font-size="13" font-weight="700" fill="#fff">★</text></svg></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Green = cheaper than the subject home, amber = within ±5%, red = pricier. */
function compIcon(pin: CompPin, subjectPrice: number, active: boolean) {
  const ratio = pin.price / subjectPrice;
  const bg = active ? "#16211d" : ratio <= 0.95 ? "#15803d" : ratio >= 1.05 ? "#b91c1c" : "#b45309";
  const label = formatCompactPrice(pin.price, pin.listingType);
  return L.divIcon({
    className: "dw-pin",
    html: `<div style="transform:translate(-50%,-100%);display:inline-flex;align-items:center;white-space:nowrap;padding:3px 9px;border-radius:999px;background:${bg};color:#fff;font:600 12px/1.4 var(--font-sans);box-shadow:0 2px 8px rgb(0 0 0 / .22);border:1px solid rgb(0 0 0 / .08);${active ? "scale:1.12;" : ""}">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !points.length) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14, animate: false });
  }, [map, points]);
  return null;
}

export default function CompsMap({ config, subject, comps, activeId, onSelect }: CompsMapProps) {
  const points = useMemo<[number, number][]>(
    () => [[subject.lat, subject.lng], ...comps.map((c) => [c.lat, c.lng] as [number, number])],
    [subject, comps],
  );
  const icons = useMemo(
    () =>
      new Map(
        comps.map((c) => [
          c.id,
          { normal: compIcon(c, subject.price, false), active: compIcon(c, subject.price, true) },
        ]),
      ),
    [comps, subject.price],
  );
  const sub = useMemo(() => subjectIcon(), []);
  return (
    <MapContainer
      center={[subject.lat, subject.lng]}
      zoom={13}
      className="size-full"
      scrollWheelZoom={false}
    >
      <TileLayer url={config.tileUrl} attribution={config.attribution} maxZoom={config.maxZoom} />
      <FitAll points={points} />
      <Marker position={[subject.lat, subject.lng]} icon={sub} zIndexOffset={1000}>
        <Popup closeButton={false} offset={[0, -40]}>
          <p className="text-sm font-semibold">{subject.label}</p>
          <p className="text-muted text-xs">
            {formatCompactPrice(subject.price, subject.listingType)}
            {subject.listingType === "rent" ? "/mo" : ""} · this home
          </p>
        </Popup>
      </Marker>
      {comps.map((c) => {
        const set = icons.get(c.id)!;
        const active = activeId === c.id;
        const ppsf = c.sqft ? `$${Math.round(c.price / c.sqft)}/ft²` : null;
        return (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={active ? set.active : set.normal}
            zIndexOffset={active ? 900 : 0}
            eventHandlers={{
              mouseover: () => onSelect?.(c.id),
              mouseout: () => onSelect?.(null),
              click: () => onSelect?.(c.id),
            }}
          >
            <Popup closeButton={false} offset={[0, -28]}>
              <p className="text-sm font-semibold">
                {formatCompactPrice(c.price, c.listingType)}
                {c.listingType === "rent" ? "/mo" : ""}
              </p>
              <p className="text-muted text-xs">
                {c.street} · {c.distanceKm.toFixed(1)} km away
              </p>
              <p className="text-muted text-xs">
                {c.beds === 0 ? "Studio" : `${c.beds ?? "—"} bd`} · {formatBaths(c.baths)} ba
                {c.sqft ? ` · ${formatNumber(c.sqft)} ft²` : ""}
                {ppsf ? ` · ${ppsf}` : ""}
              </p>
              <div className="mt-1.5 flex items-center gap-3">
                <Link
                  href={`/homes/${c.slug}`}
                  className="text-brand-600 text-xs font-semibold hover:underline"
                >
                  View home →
                </Link>
                <a
                  href={directionsUrl(c.lat, c.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-ink inline-flex items-center gap-1 text-xs font-medium"
                >
                  <Navigation className="size-3" /> Directions
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
      {/* Faint connector lines from the subject home to each comp. */}
      {comps.map((c) => (
        <Polyline
          key={`line-${c.id}`}
          positions={[
            [subject.lat, subject.lng],
            [c.lat, c.lng],
          ]}
          pathOptions={{ color: "#0f5c4c", weight: 1.5, opacity: 0.35, dashArray: "5 5" }}
          interactive={false}
        />
      ))}
    </MapContainer>
  );
}
