import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/session";
import { getFavoriteIds } from "@/server/listings";
import { getSettings } from "@/server/settings";
import { interpretSearch } from "@/server/ai/features";
import { getGeocoding, getMap, getSearch } from "@/providers";
import { parseSearchParams, type SearchQuery } from "@/lib/search/query";
import { looksLikeNaturalLanguage } from "@/lib/ai/nl-parser";
import { SearchView, type Interpretation } from "@/components/search/search-view";

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const sp = await props.searchParams;
  const place = typeof sp.place === "string" ? sp.place.split(",")[0] : null;
  const rent = sp.type === "rent";
  return { title: `${rent ? "Rentals" : "Homes for sale"}${place ? ` in ${place}` : ""}` };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const sp = await props.searchParams;
  const urlParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") urlParams.set(k, v);

  const user = await getCurrentUser();
  let query: SearchQuery = parseSearchParams(urlParams);
  let place = urlParams.get("place");
  let interpretation: Interpretation | null = null;

  // Natural-language requests become structured filters (URL values win).
  if (query.q && looksLikeNaturalLanguage(query.q)) {
    try {
      const r = await interpretSearch(query.q, user?.id ?? null);
      const explicit = new Set(urlParams.keys());
      const keyMap: Record<string, string> = {
        listingType: "type",
        minBeds: "beds",
        minBaths: "baths",
        propertyTypes: "types",
        minYearBuilt: "minYear",
        petsAllowed: "pets",
      };
      const merged: Record<string, unknown> = { ...query };
      for (const [k, v] of Object.entries(r.filters))
        if (!explicit.has(keyMap[k] ?? k)) merged[k] = v;
      query = { ...(merged as SearchQuery), q: undefined };
      if (r.place && !query.bbox) {
        query.bbox = r.place.bbox;
        place = r.place.label;
      } else if (r.placeText && !r.place) {
        // Unknown place: fall back to text matching on city/neighborhood.
        query.q = r.placeText;
      }
      interpretation = { text: sp.q as string, chips: r.chips, usedModel: r.usedModel };
    } catch {
      /* AI disabled or unavailable → plain full-text search */
    }
  }

  if (place && !query.bbox) {
    const [hit] = await getGeocoding().geocode(place, { limit: 1 });
    if (hit?.bbox) {
      query.bbox = hit.bbox;
      place = hit.label;
    } else {
      query.q = place;
    }
  }

  const search = getSearch();
  const [results, pins, favs, general] = await Promise.all([
    search.search(query),
    search.pins({ ...query, page: 1 }),
    getFavoriteIds(user?.id),
    getSettings("general"),
  ]);

  return (
    <SearchView
      query={query}
      place={place}
      results={results}
      pins={pins}
      favoriteIds={[...favs]}
      mapConfig={getMap().getConfig()}
      fallbackCenter={general.defaultMapCenter}
      interpretation={interpretation}
      signedIn={Boolean(user)}
    />
  );
}
