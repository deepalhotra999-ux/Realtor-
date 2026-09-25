import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getFavoriteListings } from "@/server/listings";
import { getSearch } from "@/providers";
import { AMENITY_KEYS, PROPERTY_TYPES } from "@/lib/domain";
import { rankListings, type Preferences } from "@/lib/ai/match";
import { inferPreferences, mergePreferences } from "@/lib/ai/personalize";
import { DEFAULT_QUERY, type SearchQuery } from "@/lib/search/query";

const storedPrefsSchema = z
  .object({
    listingType: z.enum(["sale", "rent"]).optional(),
    minPrice: z.number().int().min(0).optional(),
    maxPrice: z.number().int().min(0).optional(),
    minBeds: z.number().int().min(0).optional(),
    minBaths: z.number().min(0).optional(),
    propertyTypes: z.array(z.enum(PROPERTY_TYPES)).optional(),
    features: z.array(z.enum(AMENITY_KEYS as [string, ...string[]])).optional(),
    center: z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() }).optional(),
  })
  .catch({});

export async function getHomePreferences(userId: string): Promise<Preferences> {
  const [row] = await getDb()
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return storedPrefsSchema.parse(row?.preferences?.home ?? {});
}

/**
 * Personalized matches: explicit preferences merged over preferences inferred
 * from saved homes, searched broadly and ranked with the same transparent
 * scoring as the AI Home Finder. Saved homes are excluded from results.
 */
export async function getRecommendations(userId: string, limit = 12) {
  const [explicit, saved] = await Promise.all([
    getHomePreferences(userId),
    getFavoriteListings(userId),
  ]);
  const inferred = inferPreferences(saved);
  const prefs = mergePreferences(explicit, inferred);
  const hasSignal = Object.keys(prefs).length > 0;
  if (!hasSignal) return { explicit, inferred, prefs, basedOn: 0, results: [] };

  const query: SearchQuery = {
    ...DEFAULT_QUERY,
    listingType: prefs.listingType ?? "sale",
    minPrice: prefs.minPrice,
    // Search a little wider than the budget, then let scoring rank.
    maxPrice: prefs.maxPrice ? Math.round(prefs.maxPrice * 1.1) : undefined,
    minBeds: prefs.minBeds,
    propertyTypes: prefs.propertyTypes ?? [],
    near: prefs.center ? { lat: prefs.center.lat, lng: prefs.center.lng, radiusKm: 30 } : undefined,
    pageSize: 80,
  };
  const res = await getSearch().search(query);
  const savedIds = new Set(saved.map((s) => s.id));
  const results = rankListings(
    res.items.filter((i) => !savedIds.has(i.id)),
    prefs,
  ).slice(0, limit);
  return { explicit, inferred, prefs, basedOn: saved.length, results };
}
