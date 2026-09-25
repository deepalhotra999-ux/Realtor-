"use client";

import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, Polygon } from "geojson";
import type { MapConfig } from "@/providers/map/types";

/** Free OpenFreeMap vector style (no API key) — usable via MAP_STYLE_URL. */
export const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Classic raster street style built from XYZ tiles — the same look the old
 * Leaflet map had (default: OpenStreetMap standard tiles). Used whenever no
 * vector `styleUrl` override is configured.
 */
export function rasterStyle(config: MapConfig): StyleSpecification {
  return {
    version: 8,
    sources: {
      "dw-raster": {
        type: "raster",
        tiles: [config.tileUrl],
        tileSize: 256,
        maxzoom: config.maxZoom,
        attribution: config.attribution,
      },
    },
    layers: [{ id: "dw-raster", type: "raster", source: "dw-raster" }],
  };
}

/**
 * Shared MapLibre GL helpers for the Dwellwise maps. By default the maps use
 * the classic raster street tiles (the old look); `config.styleUrl` switches
 * to a vector style when the environment provides one.
 */
export function createMaplibreMap(
  container: HTMLElement,
  config: MapConfig,
  opts: { lng: number; lat: number; zoom: number },
): maplibregl.Map {
  return new maplibregl.Map({
    container,
    style: config.styleUrl || rasterStyle(config),
    center: [opts.lng, opts.lat],
    zoom: opts.zoom,
    maxZoom: config.maxZoom,
    attributionControl: { compact: true },
  });
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** Price-pill marker inner HTML shared by the search and comparable maps. */
export function pillHtml(label: string, sub: string | null, bg: string, active: boolean): string {
  return `<div class="dw-pill"${active ? ' data-active="true"' : ""} style="background:${bg}"><span>${label}</span>${
    sub ? `<span class="dw-pill-sub">${sub}</span>` : ""
  }</div>`;
}

/** Dense-cluster dot marker inner HTML. */
export function dotHtml(bg: string): string {
  return `<div class="dw-dot" style="background:${bg}"></div>`;
}

/** Fit the map to a list of points once; no-op when empty. */
export function fitPoints(
  map: maplibregl.Map,
  points: Array<{ lat: number; lng: number }>,
  padding = 56,
): void {
  if (points.length === 0) return;
  const bounds = new maplibregl.LngLatBounds();
  for (const p of points) bounds.extend([p.lng, p.lat]);
  map.fitBounds(bounds, { padding, animate: false });
}

/** Rough circle polygon (meters) for "approximate location" rendering. */
export function circlePolygon(lng: number, lat: number, radiusM: number, steps = 64): Polygon {
  const ring: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const dx = radiusM * Math.cos(a);
    const dy = radiusM * Math.sin(a);
    ring.push([
      lng + dx / (111320 * Math.cos((lat * Math.PI) / 180)),
      lat + dy / 110540,
    ]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

/** Add or replace a named GeoJSON line layer (driving routes, comp connectors). */
export function setLineLayer(
  map: maplibregl.Map,
  id: string,
  lines: Array<Array<[number, number]>>,
  paint: NonNullable<maplibregl.LineLayerSpecification["paint"]>,
): void {
  const apply = () => {
    const data: FeatureCollection = {
      type: "FeatureCollection",
      features: lines.map((coords) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      })),
    };
    const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(id, { type: "geojson", data });
      map.addLayer({ id, type: "line", source: id, paint });
    }
  };
  if (map.isStyleLoaded()) apply();
  else map.once("load", apply);
}

/** Remove a named line layer and its source, if present. */
export function removeLineLayer(map: maplibregl.Map, id: string): void {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
}
