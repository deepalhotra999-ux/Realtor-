"use client";

import dynamic from "next/dynamic";

function MapSkeleton() {
  return <div className="skeleton size-full" />;
}

/** Leaflet touches `window`, so maps are client-only. */
export const SearchMap = dynamic(() => import("./search-map"), {
  ssr: false,
  loading: MapSkeleton,
});
export const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: MapSkeleton,
});
export const CompsMap = dynamic(() => import("./comps-map"), {
  ssr: false,
  loading: MapSkeleton,
});
export type { CompPin, CompsMapProps } from "./comps-map";
