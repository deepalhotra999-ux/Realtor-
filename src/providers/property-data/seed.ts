import type { AmenityKey, ListingStatus, PropertyType } from "@/lib/domain";
import { AMENITIES } from "@/lib/domain";
import { kmToDegrees, METROS, type Metro, type Neighborhood } from "@/lib/geo/places";
import { createRng, type Rng } from "@/lib/random";
import type { NormalizedListing, PropertyDataPage, PropertyDataProvider } from "./types";

/**
 * Generates realistic but entirely FICTIONAL listings in real metro areas.
 * Addresses, prices and descriptions are invented; nothing here is MLS data.
 */

const STREET_NAMES = [
  "Oakmoor",
  "Maple Hollow",
  "Cedar Crest",
  "Willowbend",
  "Juniper",
  "Sycamore",
  "Aspen Glen",
  "Birchwood",
  "Magnolia",
  "Laurel Ridge",
  "Hawthorn",
  "Linden",
  "Alder",
  "Chestnut",
  "Hazelwood",
  "Rowan",
  "Sagebrush",
  "Briarcliff",
  "Fernhill",
  "Heatherstone",
  "Larkspur",
  "Meadowlark",
  "Summit View",
  "Stonebridge",
  "Brookhaven",
  "Harbor Light",
  "Canyon Rim",
  "Prairie Wind",
  "Orchard Park",
  "Old Mill",
  "Quarry",
  "Lantern",
  "Copperleaf",
  "Bluebonnet",
  "Silverpine",
  "Foxglove",
  "Wren",
  "Kestrel",
  "Marigold",
  "Thistle",
  "Clover",
  "Amberly",
  "Ivywood",
  "Pinecone",
];
const STREET_SUFFIX = ["St", "Ave", "Ln", "Dr", "Ct", "Way", "Pl", "Terrace", "Blvd", "Loop", "Rd"];

const SCENES = ["exterior", "living", "kitchen", "bedroom", "bath", "outdoor"] as const;

const TYPE_WEIGHTS_URBAN: [PropertyType, number][] = [
  ["condo", 40],
  ["apartment", 25],
  ["townhouse", 20],
  ["single_family", 12],
  ["multi_family", 3],
];
const TYPE_WEIGHTS_SUBURBAN: [PropertyType, number][] = [
  ["single_family", 60],
  ["townhouse", 16],
  ["condo", 10],
  ["multi_family", 5],
  ["manufactured", 3],
  ["land", 3],
  ["apartment", 3],
];

const TYPE_PRICE_FACTOR: Record<PropertyType, number> = {
  single_family: 1.05,
  condo: 0.68,
  townhouse: 0.82,
  multi_family: 1.35,
  apartment: 0.6,
  land: 0.35,
  manufactured: 0.42,
};

const ADJECTIVES = [
  "Sunlit",
  "Light-filled",
  "Updated",
  "Modern",
  "Classic",
  "Airy",
  "Renovated",
  "Charming",
  "Serene",
  "Spacious",
  "Stylish",
  "Quiet",
];
const NOUN: Record<PropertyType, string[]> = {
  single_family: ["home", "bungalow", "craftsman", "ranch home", "family home"],
  condo: ["condo", "residence", "flat"],
  townhouse: ["townhome", "row home"],
  multi_family: ["duplex", "fourplex", "multi-family property"],
  apartment: ["apartment", "unit", "loft"],
  land: ["lot", "parcel"],
  manufactured: ["manufactured home"],
};

const AMENITY_POOL: Record<PropertyType, AmenityKey[]> = {
  single_family: [
    "garage",
    "fireplace",
    "central_air",
    "hardwood_floors",
    "open_floor_plan",
    "home_office",
    "basement",
    "solar",
    "fenced_yard",
    "patio",
    "garden",
    "chefs_kitchen",
    "walk_in_closet",
    "ev_charger",
    "smart_home",
    "pool",
    "guest_suite",
    "mountain_view",
  ],
  condo: [
    "in_unit_laundry",
    "dishwasher",
    "gym",
    "doorman",
    "elevator",
    "balcony",
    "rooftop_deck",
    "city_view",
    "hardwood_floors",
    "central_air",
    "bike_storage",
    "storage_unit",
    "ev_charger",
    "wheelchair_accessible",
    "pool",
  ],
  townhouse: [
    "garage",
    "in_unit_laundry",
    "patio",
    "rooftop_deck",
    "hardwood_floors",
    "central_air",
    "open_floor_plan",
    "home_office",
    "ev_charger",
    "fireplace",
    "walk_in_closet",
  ],
  multi_family: [
    "garage",
    "fenced_yard",
    "central_air",
    "basement",
    "storage_unit",
    "patio",
    "garden",
  ],
  apartment: [
    "in_unit_laundry",
    "dishwasher",
    "gym",
    "elevator",
    "balcony",
    "rooftop_deck",
    "city_view",
    "bike_storage",
    "doorman",
    "pool",
    "wheelchair_accessible",
  ],
  land: ["mountain_view", "waterfront"],
  manufactured: ["central_air", "patio", "garden", "storage_unit"],
};

const URBAN =
  /downtown|uptown|lodo|gulch|capitol hill|rino|south end|roosevelt|hillcrest|fremont|germantown/i;

function jitter(rng: Rng, n: Neighborhood) {
  const r = (n.radiusKm ?? 1.2) * Math.sqrt(rng.next());
  const theta = rng.next() * 2 * Math.PI;
  const { dLat, dLng } = kmToDegrees(r, n.lat);
  return { lat: n.lat + dLat * Math.sin(theta), lng: n.lng + dLng * Math.cos(theta) };
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

function describe(
  p: NormalizedListing["property"],
  l: { listingType: "sale" | "rent" },
  rng: Rng,
): string {
  const parts: string[] = [];
  const typeWord = NOUN[p.propertyType][0];
  if (p.propertyType === "land") {
    parts.push(
      `A ${(p.lotSqft! / 43560).toFixed(2)}-acre ${typeWord} in ${p.neighborhood}, ${p.city}.`,
    );
  } else {
    parts.push(
      `This ${p.beds}-bedroom, ${p.baths}-bath ${typeWord} offers ${p.sqft?.toLocaleString("en-US")} square feet in ${p.neighborhood}${p.yearBuilt ? `, built in ${p.yearBuilt}` : ""}.`,
    );
  }
  const labels = p.features.map((f) => AMENITIES[f as AmenityKey]?.toLowerCase()).filter(Boolean);
  if (labels.length >= 2) {
    const shown = labels.slice(0, 4);
    parts.push(
      `Highlights include ${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}.`,
    );
  }
  if (p.garageSpaces) parts.push(`${p.garageSpaces}-car garage.`);
  if (p.hoaMonthly) parts.push(`HOA dues are $${p.hoaMonthly.toLocaleString("en-US")}/month.`);
  if (l.listingType === "rent")
    parts.push(
      rng.pick([
        "Available for a 12-month lease.",
        "Flexible lease terms considered.",
        "Professionally managed.",
      ]),
    );
  parts.push("Demo listing — this property is fictional and generated for development.");
  return parts.join(" ");
}

export interface SeedOptions {
  count?: number;
  seed?: number;
  now?: Date;
}

export function generateSeedListings({
  count = 640,
  seed = 42,
  now = new Date(),
}: SeedOptions = {}): NormalizedListing[] {
  const rng = createRng(seed);
  const out: NormalizedListing[] = [];
  const day = 86_400_000;

  for (let i = 0; i < count; i++) {
    const metro: Metro = METROS[i % METROS.length];
    const hood = rng.pick(metro.neighborhoods);
    const urban = URBAN.test(hood.name);
    const listingType = rng.bool(0.3) ? "rent" : "sale";
    let propertyType = rng.weighted(urban ? TYPE_WEIGHTS_URBAN : TYPE_WEIGHTS_SUBURBAN);
    if (listingType === "sale" && propertyType === "apartment") propertyType = "condo";
    if (listingType === "rent" && (propertyType === "land" || propertyType === "multi_family"))
      propertyType = "apartment";

    const isLand = propertyType === "land";
    const compact = propertyType === "condo" || propertyType === "apartment";
    const beds = isLand
      ? null
      : compact
        ? rng.weighted([
            [0, 1],
            [1, 4],
            [2, 4],
            [3, 1.5],
          ] as const)
        : rng.weighted([
            [2, 2],
            [3, 5],
            [4, 4],
            [5, 1.5],
            [6, 0.4],
          ] as const);
    const baths = isLand
      ? null
      : Math.max(1, Math.min((beds ?? 1) + (rng.bool(0.4) ? 0.5 : 0) - (rng.bool(0.3) ? 1 : 0), 6));
    const sqft = isLand
      ? null
      : roundTo(
          Math.max(
            420,
            rng.normal(compact ? 520 + (beds ?? 0) * 330 : 700 + (beds ?? 3) * 520, 180),
          ),
          10,
        );
    const lotSqft = compact
      ? null
      : isLand
        ? roundTo(rng.float(8_000, 180_000), 100)
        : roundTo(rng.float(2_400, 14_000), 50);
    const yearBuilt = isLand
      ? null
      : rng.weighted([
          [rng.int(1905, 1949), 1],
          [rng.int(1950, 1989), 2],
          [rng.int(1990, 2014), 3],
          [rng.int(2015, now.getUTCFullYear()), 2],
        ] as const);
    const stories = isLand
      ? null
      : compact
        ? 1
        : rng.weighted([
            [1, 3],
            [2, 5],
            [3, 1],
          ] as const);
    const garageSpaces =
      compact || isLand
        ? null
        : rng.weighted([
            [0, 1],
            [1, 2],
            [2, 5],
            [3, 1],
          ] as const) || null;

    const pool = AMENITY_POOL[propertyType];
    const features = rng.sample(pool, rng.int(Math.min(2, pool.length), Math.min(7, pool.length)));
    if (garageSpaces && !features.includes("garage")) features.push("garage");
    if (!garageSpaces) {
      const gi = features.indexOf("garage");
      if (gi >= 0) features.splice(gi, 1);
    }

    const hoodFactor = 0.8 + Math.abs(Math.sin(hood.lat * 1000)) * 0.55;
    const sizeFactor = sqft ? Math.pow(sqft / 1800, 0.85) : 1;
    let price: number;
    if (listingType === "sale") {
      // Calibrated so the metro median lands near `medianPrice`.
      const base =
        (metro.medianPrice *
          TYPE_PRICE_FACTOR[propertyType] *
          hoodFactor *
          (isLand ? 1 : sizeFactor)) /
        1.3;
      price = roundTo(Math.max(85_000, base * Math.exp(rng.normal(0, 0.12))), 1_000);
    } else {
      const base =
        (metro.medianRent * Math.sqrt(hoodFactor) * Math.pow((sqft ?? 900) / 1000, 0.45)) / 1.12;
      price = roundTo(Math.max(750, base * Math.exp(rng.normal(0, 0.1))), 5);
    }

    const status: ListingStatus =
      listingType === "sale"
        ? rng.weighted([
            ["active", 78],
            ["coming_soon", 4],
            ["pending", 9],
            ["sold", 9],
          ] as const)
        : rng.weighted([
            ["active", 86],
            ["rented", 14],
          ] as const);

    const listedAt = new Date(now.getTime() - rng.int(1, 150) * day);
    const pos = jitter(rng, hood);
    const streetNo = rng.int(100, 9899);
    const street = `${streetNo} ${rng.pick(STREET_NAMES)} ${rng.pick(STREET_SUFFIX)}`;
    const unit = compact
      ? `${rng.pick(["Unit", "Apt", "#"])} ${rng.int(1, 28)}${rng.pick(["", "A", "B", "C"])}`
      : null;
    const postalCode = `${metro.zipPrefix}${String(rng.int(1, 99)).padStart(2, "0")}`;

    const hoaMonthly =
      compact || propertyType === "townhouse"
        ? roundTo(rng.float(90, 720), 5)
        : rng.bool(0.25)
          ? roundTo(rng.float(25, 160), 5)
          : null;
    const taxAnnual =
      listingType === "sale" && !isLand ? roundTo(price * rng.float(0.006, 0.019), 10) : null;

    const property: NormalizedListing["property"] = {
      propertyType,
      street,
      unit,
      city: metro.city,
      state: metro.state,
      postalCode,
      neighborhood: hood.name,
      county: metro.county,
      latitude: Math.round(pos.lat * 1e6) / 1e6,
      longitude: Math.round(pos.lng * 1e6) / 1e6,
      beds,
      baths,
      sqft,
      lotSqft,
      yearBuilt,
      stories,
      garageSpaces,
      features,
      hoaMonthly: listingType === "sale" ? hoaMonthly : null,
      taxAnnual,
      facts: {
        heating: rng.pick(["Forced air", "Heat pump", "Radiant", "Baseboard"]),
        cooling: features.includes("central_air")
          ? "Central air"
          : rng.pick(["Window units", "Mini-split", "None"]),
        parking: garageSpaces
          ? `${garageSpaces}-car garage`
          : rng.pick(["Street", "Assigned space", "Carport", "Off-street"]),
        flooring: features.includes("hardwood_floors")
          ? "Hardwood"
          : rng.pick(["Luxury vinyl", "Tile", "Carpet", "Engineered wood"]),
        schoolDistrict: `${metro.city} Unified (demo)`,
      },
    };

    const adjective = rng.pick(ADJECTIVES);
    const noun = rng.pick(NOUN[propertyType]);
    const title = isLand
      ? `${adjective} ${noun} in ${hood.name}`
      : `${adjective} ${beds === 0 ? "studio" : `${beds}-bed ${noun}`} in ${hood.name}`;

    const history: NormalizedListing["priceHistory"] = [];
    const originalPrice = rng.bool(0.25)
      ? roundTo(price * rng.float(1.02, 1.09), listingType === "sale" ? 1000 : 5)
      : price;
    history.push({ event: "listed", price: originalPrice, occurredAt: listedAt });
    if (originalPrice !== price) {
      history.push({
        event: "price_change",
        price,
        occurredAt: new Date(listedAt.getTime() + rng.int(7, 40) * day),
      });
    }
    let closedAt: Date | null = null;
    let closePrice: number | null = null;
    if (status === "pending")
      history.push({
        event: "pending",
        price,
        occurredAt: new Date(listedAt.getTime() + rng.int(5, 30) * day),
      });
    if (status === "sold" || status === "rented") {
      closedAt = new Date(Math.min(now.getTime() - day, listedAt.getTime() + rng.int(6, 60) * day));
      closePrice = roundTo(price * rng.float(0.96, 1.04), listingType === "sale" ? 1000 : 5);
      history.push({ event: status, price: closePrice, occurredAt: closedAt });
    }

    const openHouses: { startsAt: string; endsAt: string }[] = [];
    if (status === "active" && listingType === "sale" && rng.bool(0.22)) {
      const sat = new Date(now);
      sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
      sat.setUTCHours(rng.pick([16, 17, 18, 19]), 0, 0, 0);
      openHouses.push({
        startsAt: sat.toISOString(),
        endsAt: new Date(sat.getTime() + 2 * 3_600_000).toISOString(),
      });
    }

    const externalId = `DEMO-${metro.state}-${String(i + 1).padStart(5, "0")}`;
    const mediaSeed = `${seed}-${i}`;
    const scenes = isLand ? (["exterior"] as const) : SCENES.slice(0, rng.int(4, SCENES.length));
    const media = scenes.map((scene) => ({
      url: `/demo-media/${propertyType}/${mediaSeed}/${scene}.svg`,
      alt: `${scene === "exterior" ? "Exterior" : scene[0].toUpperCase() + scene.slice(1)} illustration (demo)`,
      kind: "photo" as const,
    }));

    out.push({
      externalId,
      property,
      listing: {
        listingType,
        status,
        price,
        title,
        description: describe(property, { listingType }, rng),
        listedAt,
        closedAt,
        closePrice,
        availableFrom:
          listingType === "rent"
            ? new Date(now.getTime() + rng.int(0, 45) * day).toISOString().slice(0, 10)
            : null,
        leaseTermMonths: listingType === "rent" ? rng.pick([6, 12, 12, 12, 18, 24]) : null,
        deposit: listingType === "rent" ? roundTo(price * rng.pick([1, 1, 1.5]), 5) : null,
        petsAllowed: listingType === "rent" ? rng.bool(0.55) : null,
        furnished: listingType === "rent" ? rng.bool(0.12) : null,
        openHouses,
        isFeatured: status === "active" && rng.bool(0.06),
      },
      media,
      priceHistory: history,
      agentRef: `agent-${i % 48}`,
    });
  }
  return out;
}

export class SeedPropertyDataProvider implements PropertyDataProvider {
  readonly name = "seed";
  readonly source = "seed" as const;
  readonly attribution = "Fictional demo listings generated for development. Not real properties.";
  private cache: NormalizedListing[] | null = null;

  constructor(private readonly options: SeedOptions = {}) {}

  isConfigured() {
    return true;
  }

  async fetchPage(cursor?: string, pageSize = 200): Promise<PropertyDataPage> {
    this.cache ??= generateSeedListings(this.options);
    const start = cursor ? Number(cursor) : 0;
    const records = this.cache.slice(start, start + pageSize);
    const next = start + pageSize;
    return { records, nextCursor: next < this.cache.length ? String(next) : undefined };
  }
}
