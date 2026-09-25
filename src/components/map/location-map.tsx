"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer } from "react-leaflet";
import type { MapConfig } from "@/providers/map/types";

const icon = L.divIcon({
  className: "dw-pin",
  html: `<div style="transform:translate(-50%,-100%)"><svg width="34" height="42" viewBox="0 0 34 42"><path d="M17 41s15-13.6 15-24A15 15 0 0 0 2 17c0 10.4 15 24 15 24z" fill="#0f5c4c" stroke="#fff" stroke-width="2"/><circle cx="17" cy="17" r="6" fill="#fff"/></svg></div>`,
  iconSize: [0, 0],
});

export default function LocationMap({
  config,
  lat,
  lng,
  approximate = false,
}: {
  config: MapConfig;
  lat: number;
  lng: number;
  approximate?: boolean;
}) {
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
    </MapContainer>
  );
}
