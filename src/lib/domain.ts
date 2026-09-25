/** Shared domain vocabulary used by UI, providers, AI and seed data. */

export const PROPERTY_TYPES = [
  "single_family",
  "condo",
  "townhouse",
  "multi_family",
  "apartment",
  "land",
  "manufactured",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: "House",
  condo: "Condo",
  townhouse: "Townhome",
  multi_family: "Multi-family",
  apartment: "Apartment",
  land: "Land",
  manufactured: "Manufactured",
};

export const LISTING_TYPES = ["sale", "rent"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "coming_soon",
  "active",
  "pending",
  "sold",
  "rented",
  "off_market",
  "expired",
  "suspended",
  "removed",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Statuses a listing owner may set; the rest are set by automation or admins. */
export const OWNER_LISTING_STATUSES = [
  "draft",
  "coming_soon",
  "active",
  "pending",
  "sold",
  "rented",
  "off_market",
] as const satisfies readonly ListingStatus[];

/** Publicly visible (searchable) statuses. */
export const PUBLIC_LISTING_STATUSES = ["active", "coming_soon", "pending"] as const;

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_review: "In review",
  coming_soon: "Coming soon",
  active: "For sale",
  pending: "Pending",
  sold: "Sold",
  rented: "Rented",
  off_market: "Off market",
  expired: "Expired",
  suspended: "Suspended",
  removed: "Removed",
};

/** Normalised amenity keys stored in `properties.features`. */
export const AMENITIES = {
  pool: "Pool",
  garage: "Garage",
  ev_charger: "EV charger",
  fireplace: "Fireplace",
  central_air: "Central air",
  hardwood_floors: "Hardwood floors",
  open_floor_plan: "Open floor plan",
  home_office: "Home office",
  basement: "Basement",
  solar: "Solar panels",
  fenced_yard: "Fenced yard",
  waterfront: "Waterfront",
  mountain_view: "Mountain view",
  city_view: "City view",
  in_unit_laundry: "In-unit laundry",
  dishwasher: "Dishwasher",
  gym: "Fitness center",
  doorman: "Doorman",
  elevator: "Elevator",
  balcony: "Balcony",
  rooftop_deck: "Rooftop deck",
  wheelchair_accessible: "Accessible",
  smart_home: "Smart home",
  guest_suite: "Guest suite",
  chefs_kitchen: "Chef's kitchen",
  walk_in_closet: "Walk-in closet",
  patio: "Patio",
  garden: "Garden",
  bike_storage: "Bike storage",
  storage_unit: "Storage unit",
} as const;
export type AmenityKey = keyof typeof AMENITIES;
export const AMENITY_KEYS = Object.keys(AMENITIES) as AmenityKey[];

export function isAmenity(key: string): key is AmenityKey {
  return key in AMENITIES;
}
