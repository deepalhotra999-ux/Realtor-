# Providers

Every capability that would normally depend on a third-party (often paid) service is expressed as an interface
in `src/providers/<capability>/types.ts`. The registry `src/providers/index.ts` is the **only** place that picks
an implementation, based on environment variables. Product code never imports an implementation directly.

| Interface              | File                               | Implementations (default first)          | Env var                  |
| ---------------------- | ---------------------------------- | ---------------------------------------- | ------------------------ |
| `AIProvider`           | `providers/ai/types.ts`            | Ollama → Mock (auto fallback), Mock only | `AI_PROVIDER`            |
| `MapProvider`          | `providers/map/types.ts`           | Any XYZ raster tiles (OSM default)       | `MAP_TILE_URL`           |
| `GeocodingProvider`    | `providers/geocoding/types.ts`     | Local offline gazetteer, Nominatim       | `GEOCODING_PROVIDER`     |
| `StorageProvider`      | `providers/storage/types.ts`       | Local disk, S3-compatible (MinIO)        | `STORAGE_PROVIDER`       |
| `EmailProvider`        | `providers/email/types.ts`         | DB outbox, SMTP (Mailpit)                | `EMAIL_PROVIDER`         |
| `SmsProvider`          | `providers/sms/types.ts`           | DB outbox                                | `SMS_PROVIDER`           |
| `SearchProvider`       | `providers/search/types.ts`        | PostgreSQL FTS + PostGIS                 | `SEARCH_PROVIDER`        |
| `PropertyDataProvider` | `providers/property-data/types.ts` | Fictional seed generator, RESO Web API   | `PROPERTY_DATA_PROVIDER` |
| `PaymentProvider`      | `providers/payment/types.ts`       | Mock checkout                            | `PAYMENT_PROVIDER`       |

`GET /api/health` reports which implementation is active for each capability.

## Adding an adapter

1. Implement the interface in a new file, e.g. `src/providers/payment/stripe.ts`.
2. Add the option to the env schema in `src/lib/env.ts` (keep the free option as the default).
3. Add a branch in the matching getter in `src/providers/index.ts`.
4. Add unit tests with an injected `fetch` (see `providers/ai/ollama.test.ts`).

Nothing above the provider layer changes.

## Notes per provider

### AI

`kind: "llm"` providers generate text; `kind: "deterministic"` providers (the mock) never do. AI features check
the kind and use rule-based, fact-grounded paths when no model is available. See [AI.md](AI.md).

### Maps

The default tile server is the OpenStreetMap community server. It is free but has a
[usage policy](https://operations.osmfoundation.org/policies/tiles/) — fine for development and small launches;
self-host tiles (e.g. OpenMapTiles, Protomaps) for real production traffic.

### Geocoding

The local provider resolves the metros, neighborhoods, cities, states and ZIP prefixes in
`src/lib/geo/places.ts` with no network calls. Nominatim is free but limited to 1 request/second on the public
instance — the adapter throttles itself; self-host Nominatim for volume.

### Property data (MLS / IDX)

`ResoWebApiProvider` maps the RESO Data Dictionary `Property` resource into `NormalizedListing`. It is disabled
until you supply credentials to a feed you are licensed to use. Records missing required facts are skipped —
never filled in. The import pipeline (`src/server/import/pipeline.ts`) is idempotent.

### Payments

`MockPaymentProvider` issues HMAC-signed, expiring checkout sessions and a local checkout page where you simulate
success or a decline. No card data is collected. A real adapter implements `createCheckout`,
`completeCheckout` and `cancelSubscription`; the billing service above it is provider-agnostic.
