import type { GeocodeResult, GeocodingProvider } from "./types";

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  addresstype?: string;
  importance?: number;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
  address?: Record<string, string>;
}

/**
 * OpenStreetMap Nominatim. Free; the public instance allows ≤1 request/second
 * with an identifying User-Agent (https://operations.osmfoundation.org/policies/nominatim/).
 * For production traffic, self-host Nominatim and point NOMINATIM_URL at it.
 */
export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly name = "nominatim";
  private lastCall = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async throttle() {
    const wait = this.lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCall = Date.now();
  }

  private map(p: NominatimPlace): GeocodeResult {
    const a = p.address ?? {};
    const kind: GeocodeResult["kind"] = a.house_number
      ? "address"
      : p.addresstype === "postcode"
        ? "postal_code"
        : p.addresstype === "state"
          ? "state"
          : p.addresstype === "suburb" || p.addresstype === "neighbourhood"
            ? "neighborhood"
            : "city";
    const bb = p.boundingbox?.map(Number);
    return {
      label: p.display_name,
      lat: Number(p.lat),
      lng: Number(p.lon),
      kind,
      city: a.city ?? a.town ?? a.village,
      state: a["ISO3166-2-lvl4"]?.split("-")[1],
      postalCode: a.postcode,
      neighborhood: a.neighbourhood ?? a.suburb,
      bbox: bb ? [bb[2], bb[0], bb[3], bb[1]] : undefined,
      confidence: Math.min(1, p.importance ?? 0.5),
    };
  }

  async geocode(query: string, opts?: { limit?: number }): Promise<GeocodeResult[]> {
    await this.throttle();
    const url = new URL("/search", this.baseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "us");
    url.searchParams.set("limit", String(opts?.limit ?? 5));
    const res = await this.fetchImpl(url, {
      headers: { "user-agent": this.userAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
    return ((await res.json()) as NominatimPlace[]).map((p) => this.map(p));
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    await this.throttle();
    const url = new URL("/reverse", this.baseUrl);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    const res = await this.fetchImpl(url, {
      headers: { "user-agent": this.userAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as NominatimPlace & { error?: string };
    return body.error ? null : this.map(body);
  }
}
