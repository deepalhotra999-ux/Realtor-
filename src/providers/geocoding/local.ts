import { EXTRA_CITIES, haversineKm, kmToDegrees, METROS, US_STATES } from "@/lib/geo/places";
import type { GeocodeResult, GeocodingProvider } from "./types";

function bboxAround(lat: number, lng: number, km: number): [number, number, number, number] {
  const { dLat, dLng } = kmToDegrees(km, lat);
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s,]/g, "")
    .replace(/\s+/g, " ")
    .trim();

interface Entry extends GeocodeResult {
  keys: string[];
}

function buildIndex(): Entry[] {
  const entries: Entry[] = [];
  for (const m of METROS) {
    const cityKey = norm(m.city);
    entries.push({
      label: `${m.city}, ${m.state}`,
      lat: m.lat,
      lng: m.lng,
      kind: "city",
      city: m.city,
      state: m.state,
      bbox: bboxAround(m.lat, m.lng, 14),
      confidence: 1,
      keys: [
        cityKey,
        `${cityKey} ${m.state.toLowerCase()}`,
        `${cityKey}, ${m.state.toLowerCase()}`,
        `${cityKey} ${norm(m.stateName)}`,
      ],
    });
    for (const n of m.neighborhoods) {
      const nk = norm(n.name);
      entries.push({
        label: `${n.name}, ${m.city}, ${m.state}`,
        lat: n.lat,
        lng: n.lng,
        kind: "neighborhood",
        city: m.city,
        state: m.state,
        neighborhood: n.name,
        bbox: bboxAround(n.lat, n.lng, (n.radiusKm ?? 1.2) * 1.6),
        confidence: 0.95,
        keys: [nk, `${nk} ${cityKey}`, `${nk}, ${cityKey}`],
      });
    }
  }
  for (const c of EXTRA_CITIES) {
    const ck = norm(c.city);
    entries.push({
      label: `${c.city}, ${c.state}`,
      lat: c.lat,
      lng: c.lng,
      kind: "city",
      city: c.city,
      state: c.state,
      bbox: bboxAround(c.lat, c.lng, 16),
      confidence: 0.9,
      keys: [ck, `${ck} ${c.state.toLowerCase()}`, `${ck}, ${c.state.toLowerCase()}`],
    });
  }
  for (const [abbr, name] of Object.entries(US_STATES)) {
    const inState = [...METROS, ...EXTRA_CITIES].filter((c) => c.state === abbr);
    if (!inState.length) continue;
    const lat = inState.reduce((s, c) => s + c.lat, 0) / inState.length;
    const lng = inState.reduce((s, c) => s + c.lng, 0) / inState.length;
    entries.push({
      label: name,
      lat,
      lng,
      kind: "state",
      state: abbr,
      bbox: bboxAround(lat, lng, 250),
      confidence: 0.7,
      keys: [norm(name), abbr.toLowerCase()],
    });
  }
  return entries;
}

let INDEX: Entry[] | null = null;

/** Offline geocoder: zero network calls, instant, deterministic. */
export class LocalGeocodingProvider implements GeocodingProvider {
  readonly name = "local";

  private get index() {
    return (INDEX ??= buildIndex());
  }

  async geocode(query: string, opts?: { limit?: number }): Promise<GeocodeResult[]> {
    const q = norm(query);
    if (!q) return [];
    const limit = opts?.limit ?? 5;

    // ZIP codes: match metros by prefix.
    const zip = q.match(/^\d{3,5}$/)?.[0];
    if (zip) {
      return METROS.filter((m) => zip.startsWith(m.zipPrefix) || m.zipPrefix.startsWith(zip))
        .slice(0, limit)
        .map((m) => ({
          label: `${zip.length === 5 ? zip : m.zipPrefix + "xx"} · ${m.city}, ${m.state}`,
          lat: m.lat,
          lng: m.lng,
          kind: "postal_code" as const,
          city: m.city,
          state: m.state,
          postalCode: zip.length === 5 ? zip : undefined,
          bbox: bboxAround(m.lat, m.lng, 14),
          confidence: 0.6,
        }));
    }

    const scored: { e: Entry; score: number }[] = [];
    for (const e of this.index) {
      let best = 0;
      for (const k of e.keys) {
        if (k === q) best = Math.max(best, 1);
        else if (k.startsWith(q)) best = Math.max(best, 0.8 - (k.length - q.length) * 0.005);
        else if (q.startsWith(k + " ") || q.startsWith(k + ",")) best = Math.max(best, 0.7);
        else if (k.includes(q) && q.length >= 3) best = Math.max(best, 0.5);
      }
      if (best > 0) scored.push({ e, score: best * e.confidence });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ e, score }) => {
        const { keys: _keys, ...rest } = e;
        void _keys;
        return { ...rest, confidence: Math.round(score * 100) / 100 };
      });
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    let best: { e: Entry; d: number } | null = null;
    for (const e of this.index) {
      if (e.kind !== "neighborhood" && e.kind !== "city") continue;
      const d = haversineKm({ lat, lng }, e);
      if (!best || d < best.d) best = { e, d };
    }
    if (!best || best.d > 60) return null;
    const { keys: _keys, ...rest } = best.e;
    void _keys;
    return { ...rest, confidence: Math.max(0.1, 1 - best.d / 60) };
  }
}
