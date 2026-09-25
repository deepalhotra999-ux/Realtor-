/**
 * Map rendering configuration handed to the client-side map. Vector styles
 * (MapLibre) are preferred via `styleUrl`; `tileUrl` remains as a raster
 * fallback for XYZ tile sources (OSM, self-hosted tiles, OpenMapTiles, …).
 */
export interface MapConfig {
  provider: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  /** Vector style URL for MapLibre GL (e.g. an OpenFreeMap style). */
  styleUrl?: string;
  /** Optional subdomains for {s} templating. */
  subdomains?: string[];
}

export interface MapProvider {
  readonly name: string;
  getConfig(): MapConfig;
}

export class XyzTileMapProvider implements MapProvider {
  readonly name = "xyz";
  constructor(
    private readonly tileUrl: string,
    private readonly attribution: string,
    private readonly maxZoom = 19,
    private readonly styleUrl?: string,
  ) {}

  getConfig(): MapConfig {
    return {
      provider: this.tileUrl.includes("openstreetmap.org") ? "openstreetmap" : this.name,
      tileUrl: this.tileUrl,
      attribution: this.attribution,
      maxZoom: this.maxZoom,
      styleUrl: this.styleUrl,
    };
  }
}
