export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  kind: "address" | "neighborhood" | "city" | "state" | "postal_code";
  city?: string;
  state?: string;
  postalCode?: string;
  neighborhood?: string;
  /** [west, south, east, north] */
  bbox?: [number, number, number, number];
  /** 0–1 match confidence. */
  confidence: number;
}

/**
 * Forward/reverse geocoding. Implementations: offline local gazetteer
 * (default) and OpenStreetMap Nominatim (public or self-hosted). Add Pelias,
 * Photon, or a commercial geocoder by implementing this interface.
 */
export interface GeocodingProvider {
  readonly name: string;
  geocode(query: string, opts?: { limit?: number }): Promise<GeocodeResult[]>;
  reverse(lat: number, lng: number): Promise<GeocodeResult | null>;
}
