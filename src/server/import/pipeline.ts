/**
 * Listing import pipeline: PropertyDataProvider → normalised records → DB.
 * Idempotent (upserts on source + externalId), so re-running an import updates
 * prices/statuses instead of duplicating properties.
 *
 * Intentionally free of `server-only` so CLI scripts can reuse it.
 */
import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/server/db/schema";
import { listingSlug } from "@/lib/slug";
import type { NormalizedListing, PropertyDataProvider } from "@/providers/property-data/types";

type DB = PostgresJsDatabase<typeof schema>;

export interface ImportOptions {
  /** Map upstream agent refs to local agent user ids. */
  resolveAgent?: (
    ref: string | undefined,
  ) => { agentId: string; brokerageId: string | null } | null;
  onProgress?: (done: number) => void;
}

export async function importRecord(
  db: DB,
  source: "seed" | "mls" | "import",
  r: NormalizedListing,
  opts: ImportOptions = {},
) {
  const p = r.property;
  const [property] = await db
    .insert(schema.properties)
    .values({
      source,
      externalId: r.externalId,
      propertyType: p.propertyType,
      street: p.street,
      unit: p.unit ?? null,
      city: p.city,
      state: p.state,
      postalCode: p.postalCode,
      neighborhood: p.neighborhood ?? null,
      county: p.county ?? null,
      latitude: p.latitude,
      longitude: p.longitude,
      location: { x: p.longitude, y: p.latitude },
      beds: p.beds ?? null,
      baths: p.baths ?? null,
      sqft: p.sqft ?? null,
      lotSqft: p.lotSqft ?? null,
      yearBuilt: p.yearBuilt ?? null,
      stories: p.stories ?? null,
      garageSpaces: p.garageSpaces ?? null,
      features: p.features,
      hoaMonthly: p.hoaMonthly ?? null,
      taxAnnual: p.taxAnnual ?? null,
      facts: p.facts ?? {},
    })
    .onConflictDoUpdate({
      target: [schema.properties.source, schema.properties.externalId],
      set: {
        beds: sql`excluded.beds`,
        baths: sql`excluded.baths`,
        sqft: sql`excluded.sqft`,
        features: sql`excluded.features`,
        hoaMonthly: sql`excluded.hoa_monthly`,
        taxAnnual: sql`excluded.tax_annual`,
        facts: sql`excluded.facts`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.properties.id });

  const agent = opts.resolveAgent?.(r.agentRef) ?? null;
  const l = r.listing;
  const slug = listingSlug(p, `${source}:${r.externalId}:${l.listingType}`);

  const existing = await db
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(
      and(
        eq(schema.listings.propertyId, property.id),
        eq(schema.listings.listingType, l.listingType),
      ),
    )
    .limit(1);

  const values = {
    slug,
    propertyId: property.id,
    listingType: l.listingType,
    status: l.status,
    price: l.price,
    title: l.title,
    description: l.description,
    agentId: agent?.agentId ?? null,
    brokerageId: agent?.brokerageId ?? null,
    isFeatured: l.isFeatured ?? false,
    listedAt: l.listedAt,
    closedAt: l.closedAt ?? null,
    closePrice: l.closePrice ?? null,
    availableFrom: l.availableFrom ?? null,
    leaseTermMonths: l.leaseTermMonths ?? null,
    deposit: l.deposit ?? null,
    petsAllowed: l.petsAllowed ?? null,
    furnished: l.furnished ?? null,
    openHouses: l.openHouses ?? [],
  };

  let listingId: string;
  if (existing[0]) {
    listingId = existing[0].id;
    const { slug: _slug, ...update } = values;
    void _slug;
    await db.update(schema.listings).set(update).where(eq(schema.listings.id, listingId));
  } else {
    const [row] = await db
      .insert(schema.listings)
      .values(values)
      .returning({ id: schema.listings.id });
    listingId = row.id;
  }

  // Media & history are replaced wholesale from the source of truth.
  await db.delete(schema.propertyMedia).where(eq(schema.propertyMedia.propertyId, property.id));
  if (r.media.length) {
    await db.insert(schema.propertyMedia).values(
      r.media.map((m, i) => ({
        propertyId: property.id,
        kind: m.kind ?? "photo",
        url: m.url,
        alt: m.alt,
        caption: m.caption ?? null,
        sortOrder: i,
      })),
    );
  }
  await db.delete(schema.priceHistory).where(eq(schema.priceHistory.listingId, listingId));
  if (r.priceHistory.length) {
    await db.insert(schema.priceHistory).values(
      r.priceHistory.map((h) => ({
        propertyId: property.id,
        listingId,
        event: h.event,
        price: h.price,
        occurredAt: h.occurredAt,
      })),
    );
  }
  return { propertyId: property.id, listingId };
}

export async function runImport(db: DB, provider: PropertyDataProvider, opts: ImportOptions = {}) {
  let cursor: string | undefined;
  let done = 0;
  do {
    const page = await provider.fetchPage(cursor);
    for (const record of page.records) {
      await importRecord(db, provider.source, record, opts);
      done++;
    }
    opts.onProgress?.(done);
    cursor = page.nextCursor;
  } while (cursor);
  return { imported: done };
}
