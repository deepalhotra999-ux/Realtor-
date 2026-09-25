"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Loader2, Navigation, Route as RouteIcon, X } from "lucide-react";
import type { MapConfig } from "@/providers/map/types";
import { directionsUrl } from "@/lib/map-pricing";

const icon = L.divIcon({
  className: "dw-pin",
  html: `<div style="transform:translate(-50%,-100%)"><svg width="34" height="42" viewBox="0 0 34 42"><path d="M17 41s15-13.6 15-24A15 15 0 0 0 2 17c0 10.4 15 24 15 24z" fill="#0f5c4c" stroke="#fff" stroke-width="2"/><circle cx="17" cy="17" r="6" fill="#fff"/></svg></div>`,
  iconSize: [0, 0],
});

interface RouteInfo {
  line: [number, number][];
  km: number;
  minutes: number;
}

type RouteState = "idle" | "locating" | "loading" | "error";

function FitRoute({ line }: { line: [number, number][] | null }) {
  const map = useMap();
  const prev = useRef<[number, number][] | null>(null);
  useEffect(() => {
    if (!line || prev.current === line) return;
    prev.current = line;
    map.fitBounds(L.latLngBounds(line), { padding: [48, 48], animate: true });
  }, [map, line]);
  return null;
}

async function fetchRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<RouteInfo> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const r = data?.routes?.[0];
  if (!r?.geometry?.coordinates?.length) throw new Error("no route");
  return {
    line: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
    km: r.distance / 1000,
    minutes: Math.round(r.duration / 60),
  };
}

export default function LocationMap({
  config,
  lat,
  lng,
  approximate = false,
  directions = false,
}: {
  config: MapConfig;
  lat: number;
  lng: number;
  approximate?: boolean;
  /** Show the "route from my location" navigation control. */
  directions?: boolean;
}) {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [state, setState] = useState<RouteState>("idle");

  const showRoute = () => {
    if (!("geolocation" in navigator)) {
      setState("error");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setState("loading");
        try {
          setRoute(
            await fetchRoute(pos.coords.latitude, pos.coords.longitude, lat, lng),
          );
          setState("idle");
        } catch {
          setState("error");
        }
      },
      () => setState("error"),
      { timeout: 12_000 },
    );
  };

  const clearRoute = () => {
    setRoute(null);
    setState("idle");
  };

  const busy = state === "locating" || state === "loading";

  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="size-full">
      <TileLayer url={config.tileUrl} attribution={config.attribution} maxZoom={config.maxZoom} />
      {approximate ? (
        <Circle
          center={[lat, lng]}
          radius={250}
          pathOptions={{ color: "#0f5c4c", fillOpacity: 0.12 }}
        />
      ) : (
        <Marker position={[lat, lng]} icon={icon} />
      )}
      {route ? (
        <Polyline
          positions={route.line}
          pathOptions={{ color: "#0f5c4c", weight: 5, opacity: 0.85 }}
        />
      ) : null}
      <FitRoute line={route?.line ?? null} />
      {directions && !approximate ? (
        <div className="absolute right-3 bottom-3 z-[500] flex flex-col items-end gap-2">
          {route ? (
            <div className="bg-surface/95 shadow-card flex items-center gap-2 rounded-full py-2 pr-2 pl-4 backdrop-blur">
              <RouteIcon className="text-brand-600 size-4" />
              <span className="tabular text-xs font-semibold">
                {route.km < 1
                  ? `${Math.round(route.km * 1000)} m`
                  : `${route.km.toFixed(1)} km`}{" "}
                · ~{route.minutes} min drive
              </span>
              <button
                type="button"
                onClick={clearRoute}
                aria-label="Clear route"
                className="hover:bg-paper rounded-full p-1"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
          {state === "error" ? (
            <a
              href={directionsUrl(lat, lng)}
              target="_blank"
              rel="noreferrer"
              className="bg-surface/95 shadow-card text-brand-700 rounded-full px-4 py-2 text-xs font-semibold backdrop-blur hover:underline"
            >
              Open directions in Maps ↗
            </a>
          ) : (
            <button
              type="button"
              onClick={showRoute}
              disabled={busy}
              className="bg-ink shadow-card inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Navigation className="size-3.5" />
              )}
              {state === "locating"
                ? "Finding you…"
                : state === "loading"
                  ? "Planning route…"
                  : route
                    ? "Re-plan route"
                    : "Route from my location"}
            </button>
          )}
        </div>
      ) : null}
    </MapContainer>
  );
}
