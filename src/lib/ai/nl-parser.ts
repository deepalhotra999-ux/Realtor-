import type { AmenityKey, ListingType, PropertyType } from "@/lib/domain";
import type { SearchQuery, SearchSort } from "@/lib/search/query";

/**
 * Deterministic natural-language → search filter parser. It powers the AI
 * search box with no model at all, and is the baseline that LLM output is
 * merged onto (LLM output can refine but is always validated).
 */

export interface ParsedSearch {
  filters: Partial<
    Pick<
      SearchQuery,
      | "listingType"
      | "minPrice"
      | "maxPrice"
      | "minBeds"
      | "minBaths"
      | "minSqft"
      | "maxSqft"
      | "minYearBuilt"
      | "maxHoa"
      | "propertyTypes"
      | "features"
      | "petsAllowed"
      | "sort"
    >
  >;
  /** Free-text location to geocode, e.g. "east austin". */
  placeText?: string;
  /** Human-readable interpretation chips. */
  chips: string[];
  /** Fraction of meaningful words understood (0–1). */
  confidence: number;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  single: 1,
  couple: 2,
};

const TYPE_PATTERNS: [RegExp, PropertyType][] = [
  [/\b(single[- ]family|houses?|detached|bungalows?|craftsman|ranch)\b/, "single_family"],
  [/\b(condos?|condominiums?)\b/, "condo"],
  [/\b(town ?homes?|town ?houses?|row ?homes?)\b/, "townhouse"],
  [/\b(duplex|triplex|fourplex|multi[- ]?family|income propert(y|ies))\b/, "multi_family"],
  [/\b(apartments?|apts?|flats?|lofts?|studios?)\b/, "apartment"],
  [/\b(land|lots?|acreage|parcels?)\b/, "land"],
  [/\b(manufactured|mobile homes?)\b/, "manufactured"],
];

const FEATURE_PATTERNS: [RegExp, AmenityKey][] = [
  [/\bpools?\b/, "pool"],
  [/\bgarages?\b/, "garage"],
  [/\b(ev|electric (car|vehicle))[- ]?(charger|charging)?\b|\bcharging station\b/, "ev_charger"],
  [/\bfireplaces?\b/, "fireplace"],
  [/\b(central air|a\/?c|air[- ]condition(ing|ed)?)\b/, "central_air"],
  [/\bhardwood\b/, "hardwood_floors"],
  [/\bopen (floor ?plan|concept|layout)\b/, "open_floor_plan"],
  [/\b(home office|office|work from home|wfh|study)\b/, "home_office"],
  [/\bbasements?\b/, "basement"],
  [/\bsolar\b/, "solar"],
  [/\b(fenced|back ?yard|yard)\b/, "fenced_yard"],
  [/\b(waterfront|lakefront|on the water)\b/, "waterfront"],
  [/\bmountain views?\b/, "mountain_view"],
  [/\b(city|skyline) views?\b/, "city_view"],
  [/\b(in[- ]unit laundry|washer|laundry)\b/, "in_unit_laundry"],
  [/\bdishwasher\b/, "dishwasher"],
  [/\b(gym|fitness)\b/, "gym"],
  [/\b(doorman|concierge)\b/, "doorman"],
  [/\belevators?\b/, "elevator"],
  [/\bbalcon(y|ies)\b/, "balcony"],
  [/\broof ?(top)? ?(deck|terrace)\b/, "rooftop_deck"],
  [/\b(wheelchair|accessible|accessibility|single[- ]level)\b/, "wheelchair_accessible"],
  [/\bsmart home\b/, "smart_home"],
  [/\b(guest suite|in[- ]law|adu|mother[- ]in[- ]law)\b/, "guest_suite"],
  [/\b(chef'?s|gourmet) kitchen\b/, "chefs_kitchen"],
  [/\bwalk[- ]in closets?\b/, "walk_in_closet"],
  [/\bpatio\b/, "patio"],
  [/\bgardens?\b/, "garden"],
  [/\bbike (storage|room)\b/, "bike_storage"],
];

const STOPWORDS = new Set(
  "a an the i we me my our looking look for find show want need would like with and or in near around to of that has have having at least under over below above less more than max min up budget is are be some any please something place home homes property properties within".split(
    " ",
  ),
);

/** "$1.2m", "850k", "850,000", "2500" → number */
export function parseMoney(raw: string): number | null {
  const m = raw
    .toLowerCase()
    .replace(/[$,\s]/g, "")
    .match(/^(\d+(?:\.\d+)?)(k|m|mm|million|thousand|grand)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2];
  if (unit === "k" || unit === "thousand" || unit === "grand") return Math.round(n * 1_000);
  if (unit === "m" || unit === "mm" || unit === "million") return Math.round(n * 1_000_000);
  return Math.round(n);
}

const MONEY = String.raw`\$?\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|mm|million|thousand|grand)?`;

function toNumber(word: string): number | null {
  if (/^\d+(\.\d+)?$/.test(word)) return Number(word);
  return WORD_NUMBERS[word] ?? null;
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
    : n >= 10_000
      ? `$${Math.round(n / 1000)}K`
      : `$${n.toLocaleString("en-US")}`;

export function parseNaturalLanguage(input: string, now = new Date()): ParsedSearch {
  const text = ` ${input.toLowerCase().replace(/[“”]/g, '"').replace(/\s+/g, " ").trim()} `;
  const filters: ParsedSearch["filters"] = {};
  const chips: string[] = [];
  const consumed: string[] = [];
  const take = (m: RegExpMatchArray | null) => {
    if (m) consumed.push(m[0]);
    return m;
  };

  // Listing type
  let listingType: ListingType | undefined;
  if (
    take(text.match(/\b(for rent|to rent|rent(al|ing)?s?|lease|leasing|per month|\/mo|monthly)\b/))
  )
    listingType = "rent";
  else if (take(text.match(/\b(for sale|to buy|buy(ing)?|purchase|own)\b/))) listingType = "sale";
  if (listingType) {
    filters.listingType = listingType;
    chips.push(listingType === "rent" ? "For rent" : "For sale");
  }

  // Bedrooms / bathrooms
  const beds = take(
    text.match(
      /\b(\d+|one|two|three|four|five|six)\s*\+?\s*(?:or more\s*)?(?:bed(room)?s?|bd|br|bdrm)\b/,
    ),
  );
  if (beds) {
    const n = toNumber(beds[1]);
    if (n !== null) {
      filters.minBeds = n;
      chips.push(`${n}+ beds`);
    }
  } else if (take(text.match(/\bstudios?\b/))) {
    filters.minBeds = 0;
    chips.push("Studio");
  }
  const baths = take(
    text.match(/\b(\d+(?:\.5)?|one|two|three|four)\s*\+?\s*(?:or more\s*)?(?:bath(room)?s?|ba)\b/),
  );
  if (baths) {
    const n = toNumber(baths[1]);
    if (n !== null) {
      filters.minBaths = n;
      chips.push(`${n}+ baths`);
    }
  }

  // Price
  const between = take(
    text.match(new RegExp(String.raw`\b(?:between|from)\s+(${MONEY})\s+(?:and|to|-)\s+(${MONEY})`)),
  );
  const range =
    between ??
    take(
      text.match(new RegExp(String.raw`(${MONEY})\s?-\s?(${MONEY})(?!\s*(?:sq|square|bed|bath))`)),
    );
  if (range) {
    let lo = parseMoney(range[1]);
    let hi = parseMoney(range[2]);
    // "400-600k" → both in thousands
    if (
      lo !== null &&
      hi !== null &&
      /k$/i.test(range[2].trim()) &&
      !/k$/i.test(range[1].trim()) &&
      lo < 1000
    )
      lo *= 1000;
    if (
      lo !== null &&
      hi !== null &&
      /m$/i.test(range[2].trim()) &&
      !/[km]$/i.test(range[1].trim()) &&
      lo < 100
    )
      lo *= 1_000_000;
    if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
    if (lo !== null) filters.minPrice = lo;
    if (hi !== null) filters.maxPrice = hi;
  } else {
    const max = take(
      text.match(
        new RegExp(
          String.raw`\b(?:under|below|less than|max(?:imum)?|up to|no more than|budget(?: of| is)?|cheaper than|within)\s+(${MONEY})`,
        ),
      ),
    );
    if (max) {
      const v = parseMoney(max[1]);
      if (v !== null) filters.maxPrice = v;
    }
    const min = take(
      text.match(
        new RegExp(
          String.raw`\b(?:over|above|more than|at least|min(?:imum)?|starting at)\s+(${MONEY})(?!\s*(?:sq|square|bed|bath))`,
        ),
      ),
    );
    if (min) {
      const v = parseMoney(min[1]);
      if (v !== null && (v >= 500 || /[$km]/.test(min[1]))) filters.minPrice = v;
    }
    const around = take(
      text.match(new RegExp(String.raw`\b(?:around|about|approximately|roughly|~)\s+(${MONEY})`)),
    );
    if (around && filters.maxPrice === undefined) {
      const v = parseMoney(around[1]);
      if (v !== null) {
        filters.minPrice = Math.round(v * 0.9);
        filters.maxPrice = Math.round(v * 1.1);
      }
    }
  }
  // Heuristic: small maxima imply rent.
  if (!filters.listingType && filters.maxPrice !== undefined && filters.maxPrice < 15_000) {
    filters.listingType = "rent";
    chips.push("For rent");
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const suffix = filters.listingType === "rent" ? "/mo" : "";
    chips.push(
      filters.minPrice !== undefined && filters.maxPrice !== undefined
        ? `${fmt(filters.minPrice)}–${fmt(filters.maxPrice)}${suffix}`
        : filters.maxPrice !== undefined
          ? `Under ${fmt(filters.maxPrice)}${suffix}`
          : `Over ${fmt(filters.minPrice!)}${suffix}`,
    );
  }

  // Size
  const sqft = take(
    text.match(
      /\b(?:at least|over|more than|min(?:imum)?|above)?\s*(\d[\d,]*)\s*\+?\s*(?:sq\.? ?ft|sqft|square feet|sf)\b/,
    ),
  );
  if (sqft) {
    const v = Number(sqft[1].replace(/,/g, ""));
    if (/\b(under|below|less than|max)\s*$/.test(text.slice(0, text.indexOf(sqft[0]))))
      filters.maxSqft = v;
    else filters.minSqft = v;
    chips.push(
      filters.maxSqft
        ? `Under ${v.toLocaleString("en-US")} sqft`
        : `${v.toLocaleString("en-US")}+ sqft`,
    );
  } else if (take(text.match(/\b(spacious|large|big|roomy)\b/))) {
    filters.minSqft = 2000;
    chips.push("2,000+ sqft");
  }

  // Age
  const built = take(
    text.match(
      /\b(?:built|newer than|built after|from)\s+(?:after\s+|since\s+)?((?:19|20)\d{2})\b/,
    ),
  );
  if (built) {
    filters.minYearBuilt = Number(built[1]);
    chips.push(`Built ${built[1]}+`);
  } else if (take(text.match(/\b(new construction|newly built|brand new|new build)\b/))) {
    filters.minYearBuilt = now.getUTCFullYear() - 3;
    chips.push("New construction");
  } else if (take(text.match(/\b(modern|contemporary)\b/))) {
    filters.minYearBuilt = 2000;
    chips.push("Built 2000+");
  }

  // HOA
  const hoa = take(
    text.match(new RegExp(String.raw`\bhoa\s+(?:under|below|less than|max)\s+(${MONEY})`)),
  );
  if (hoa) {
    const v = parseMoney(hoa[1]);
    if (v !== null) {
      filters.maxHoa = v;
      chips.push(`HOA ≤ ${fmt(v)}`);
    }
  } else if (take(text.match(/\b(no|without( an?)?|zero) hoa\b/))) {
    filters.maxHoa = 0;
    chips.push("No HOA");
  } else if (take(text.match(/\blow hoa\b/))) {
    filters.maxHoa = 250;
    chips.push("HOA ≤ $250");
  }

  // Property types
  const types = new Set<PropertyType>();
  for (const [re, type] of TYPE_PATTERNS) {
    const m = take(text.match(re));
    if (!m) continue;
    // "apartment" when buying really means a condo.
    types.add(
      type === "apartment" && filters.listingType !== "rent" && !/\bstudio/.test(m[0])
        ? "condo"
        : type,
    );
  }
  if (types.size) {
    filters.propertyTypes = [...types];
    chips.push(
      ...[...types].map(
        (t) =>
          ({
            single_family: "House",
            condo: "Condo",
            townhouse: "Townhome",
            multi_family: "Multi-family",
            apartment: "Apartment",
            land: "Land",
            manufactured: "Manufactured",
          })[t],
      ),
    );
  }

  // Amenities
  const features = new Set<AmenityKey>();
  for (const [re, key] of FEATURE_PATTERNS) if (take(text.match(re))) features.add(key);
  if (features.size) {
    filters.features = [...features];
    chips.push(...[...features].map((f) => f.replace(/_/g, " ")));
  }

  // Pets
  if (take(text.match(/\b(pet[- ]friendly|pets?( allowed| ok)?|dogs?|cats?)\b/))) {
    filters.petsAllowed = true;
    chips.push("Pet friendly");
    if (!filters.listingType) filters.listingType = "rent";
  }

  // Sort intent
  let sort: SearchSort | undefined;
  if (take(text.match(/\b(cheapest|lowest price|most affordable|affordable|budget)\b/)))
    sort = "price_asc";
  else if (take(text.match(/\b(newest|latest|just listed|recently listed)\b/))) sort = "newest";
  else if (take(text.match(/\b(biggest|largest)\b/))) sort = "sqft_desc";
  else if (take(text.match(/\b(best value|good deal|great deal|bargain)\b/))) sort = "ppsf_asc";
  if (sort) filters.sort = sort;

  // Location: text after in/near/around up to the next clause.
  let placeText: string | undefined;
  const loc = text.match(
    /\b(?:in|near|around|close to|by)\s+([a-z0-9 .'-]+?)(?=\s+(?:with|under|below|over|for|that|which|and|less|more|between|built|having|has|near|budget|max|min|no|pet)\b|[,.;!?]|\s*$)/,
  );
  if (loc) {
    const candidate = loc[1].trim().replace(/^the\s+/, "");
    if (candidate && !/^\d/.test(candidate) && !/^(a|an|my|our)\b/.test(candidate)) {
      placeText = candidate;
      consumed.push(loc[0]);
    }
  }
  if (placeText) chips.unshift(placeText.replace(/\b\w/g, (c) => c.toUpperCase()));

  // Confidence: share of meaningful words consumed by some rule.
  const words = text.split(/[^a-z0-9$.]+/).filter((w) => w && !STOPWORDS.has(w));
  const consumedText = consumed.join(" ");
  const understood = words.filter((w) => consumedText.includes(w)).length;
  const confidence = words.length ? Math.min(1, understood / words.length) : 0;

  return {
    filters,
    placeText,
    chips: [...new Set(chips)],
    confidence: Math.round(confidence * 100) / 100,
  };
}

/** True when free text reads like a sentence of requirements rather than a place name. */
export function looksLikeNaturalLanguage(input: string): boolean {
  const t = input.toLowerCase();
  if (t.split(/\s+/).length >= 4) return true;
  return /\b(bed|bath|under|over|with|pool|garage|rent|sale|condo|house|sqft|pet|\$|\d+k)\b/.test(
    t,
  );
}
