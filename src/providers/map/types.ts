/**
 * Map rendering configuration handed to the client-side Leaflet map. Any XYZ
 * raster tile source works (OSM, self-hosted tiles, OpenMapTiles, …). A vector
 * (MapLibre) provider can be added by extending `MapConfig` with a style URL.
 */
export interface MapConfig {
  provider: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
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
  ) {}

  getConfig(): MapConfig {
    return {
      provider: this.tileUrl.includes("openstreetmap.org") ? "openstreetmap" : this.name,
      tileUrl: this.tileUrl,
      attribution: this.attribution,
      maxZoom: this.maxZoom,
    };
  }
}
