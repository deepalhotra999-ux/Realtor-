/**
 * Offline gazetteer. Real public place names and approximate centroids — used
 * by the local geocoder (no network) and by the fictional seed generator.
 * Listings placed in these areas are fictional.
 */

export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
  /** Scatter radius for generated demo addresses, km. */
  radiusKm?: number;
}

export interface Metro {
  city: string;
  state: string;
  stateName: string;
  county: string;
  lat: number;
  lng: number;
  zipPrefix: string;
  /** Rough median sale price used to shape demo data, USD. */
  medianPrice: number;
  /** Rough median monthly rent, USD. */
  medianRent: number;
  neighborhoods: Neighborhood[];
}

export const METROS: Metro[] = [
  {
    city: "Austin",
    state: "TX",
    stateName: "Texas",
    county: "Travis",
    lat: 30.2672,
    lng: -97.7431,
    zipPrefix: "787",
    medianPrice: 560_000,
    medianRent: 2_050,
    neighborhoods: [
      { name: "Downtown", lat: 30.2672, lng: -97.7431, radiusKm: 0.8 },
      { name: "South Congress", lat: 30.2468, lng: -97.7507 },
      { name: "East Austin", lat: 30.2622, lng: -97.7209 },
      { name: "Hyde Park", lat: 30.3056, lng: -97.7289 },
      { name: "Mueller", lat: 30.2983, lng: -97.7054 },
      { name: "Zilker", lat: 30.2622, lng: -97.773 },
      { name: "Tarrytown", lat: 30.298, lng: -97.765 },
      { name: "Circle C", lat: 30.195, lng: -97.887, radiusKm: 2 },
    ],
  },
  {
    city: "Denver",
    state: "CO",
    stateName: "Colorado",
    county: "Denver",
    lat: 39.7392,
    lng: -104.9903,
    zipPrefix: "802",
    medianPrice: 610_000,
    medianRent: 2_100,
    neighborhoods: [
      { name: "LoDo", lat: 39.7527, lng: -105.0, radiusKm: 0.7 },
      { name: "Capitol Hill", lat: 39.7317, lng: -104.978 },
      { name: "Highlands", lat: 39.765, lng: -105.011 },
      { name: "Cherry Creek", lat: 39.717, lng: -104.953 },
      { name: "Washington Park", lat: 39.701, lng: -104.97 },
      { name: "RiNo", lat: 39.769, lng: -104.98 },
      { name: "Park Hill", lat: 39.75, lng: -104.923, radiusKm: 1.6 },
    ],
  },
  {
    city: "Seattle",
    state: "WA",
    stateName: "Washington",
    county: "King",
    lat: 47.6062,
    lng: -122.3321,
    zipPrefix: "981",
    medianPrice: 850_000,
    medianRent: 2_400,
    neighborhoods: [
      { name: "Capitol Hill", lat: 47.6253, lng: -122.3222 },
      { name: "Ballard", lat: 47.6687, lng: -122.3847 },
      { name: "Fremont", lat: 47.651, lng: -122.35, radiusKm: 0.7 },
      { name: "Queen Anne", lat: 47.637, lng: -122.357 },
      { name: "West Seattle", lat: 47.5667, lng: -122.3868 },
      { name: "Green Lake", lat: 47.6798, lng: -122.3257 },
      { name: "Columbia City", lat: 47.5597, lng: -122.2865 },
    ],
  },
  {
    city: "Raleigh",
    state: "NC",
    stateName: "North Carolina",
    county: "Wake",
    lat: 35.7796,
    lng: -78.6382,
    zipPrefix: "276",
    medianPrice: 450_000,
    medianRent: 1_750,
    neighborhoods: [
      { name: "Downtown", lat: 35.7796, lng: -78.6382, radiusKm: 0.8 },
      { name: "Five Points", lat: 35.803, lng: -78.648 },
      { name: "North Hills", lat: 35.838, lng: -78.642 },
      { name: "Oakwood", lat: 35.786, lng: -78.63, radiusKm: 0.7 },
      { name: "Cameron Village", lat: 35.79, lng: -78.66, radiusKm: 0.7 },
      { name: "Brier Creek", lat: 35.907, lng: -78.783, radiusKm: 2 },
    ],
  },
  {
    city: "Nashville",
    state: "TN",
    stateName: "Tennessee",
    county: "Davidson",
    lat: 36.1627,
    lng: -86.7816,
    zipPrefix: "372",
    medianPrice: 520_000,
    medianRent: 1_900,
    neighborhoods: [
      { name: "The Gulch", lat: 36.151, lng: -86.789, radiusKm: 0.6 },
      { name: "East Nashville", lat: 36.186, lng: -86.747, radiusKm: 1.5 },
      { name: "12 South", lat: 36.123, lng: -86.79 },
      { name: "Germantown", lat: 36.179, lng: -86.788, radiusKm: 0.6 },
      { name: "Sylvan Park", lat: 36.145, lng: -86.843 },
      { name: "Green Hills", lat: 36.106, lng: -86.815, radiusKm: 1.5 },
    ],
  },
  {
    city: "San Diego",
    state: "CA",
    stateName: "California",
    county: "San Diego",
    lat: 32.7157,
    lng: -117.1611,
    zipPrefix: "921",
    medianPrice: 960_000,
    medianRent: 3_000,
    neighborhoods: [
      { name: "North Park", lat: 32.748, lng: -117.13 },
      { name: "La Jolla", lat: 32.842, lng: -117.26, radiusKm: 0.8 },
      { name: "Pacific Beach", lat: 32.8, lng: -117.235, radiusKm: 0.8 },
      { name: "Hillcrest", lat: 32.748, lng: -117.164, radiusKm: 0.6 },
      { name: "Point Loma", lat: 32.74, lng: -117.225, radiusKm: 0.8 },
      { name: "Mission Hills", lat: 32.753, lng: -117.184, radiusKm: 0.6 },
    ],
  },
  {
    city: "Phoenix",
    state: "AZ",
    stateName: "Arizona",
    county: "Maricopa",
    lat: 33.4484,
    lng: -112.074,
    zipPrefix: "850",
    medianPrice: 430_000,
    medianRent: 1_650,
    neighborhoods: [
      { name: "Arcadia", lat: 33.499, lng: -111.978, radiusKm: 1.5 },
      { name: "Roosevelt Row", lat: 33.458, lng: -112.069, radiusKm: 0.6 },
      { name: "Biltmore", lat: 33.51, lng: -112.024 },
      { name: "Ahwatukee", lat: 33.328, lng: -111.982, radiusKm: 2.5 },
      { name: "Encanto", lat: 33.475, lng: -112.09 },
    ],
  },
  {
    city: "Charlotte",
    state: "NC",
    stateName: "North Carolina",
    county: "Mecklenburg",
    lat: 35.2271,
    lng: -80.8431,
    zipPrefix: "282",
    medianPrice: 410_000,
    medianRent: 1_700,
    neighborhoods: [
      { name: "Uptown", lat: 35.2271, lng: -80.8431, radiusKm: 0.7 },
      { name: "South End", lat: 35.212, lng: -80.859 },
      { name: "Dilworth", lat: 35.206, lng: -80.843 },
      { name: "NoDa", lat: 35.247, lng: -80.808 },
      { name: "Myers Park", lat: 35.19, lng: -80.82, radiusKm: 1.4 },
      { name: "Plaza Midwood", lat: 35.223, lng: -80.806 },
    ],
  },
];

/** Additional US cities the offline geocoder can resolve (no demo listings). */
export const EXTRA_CITIES: { city: string; state: string; lat: number; lng: number }[] = [
  { city: "New York", state: "NY", lat: 40.7128, lng: -74.006 },
  { city: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437 },
  { city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298 },
  { city: "Houston", state: "TX", lat: 29.7604, lng: -95.3698 },
  { city: "Philadelphia", state: "PA", lat: 39.9526, lng: -75.1652 },
  { city: "San Antonio", state: "TX", lat: 29.4241, lng: -98.4936 },
  { city: "Dallas", state: "TX", lat: 32.7767, lng: -96.797 },
  { city: "San Jose", state: "CA", lat: 37.3382, lng: -121.8863 },
  { city: "Jacksonville", state: "FL", lat: 30.3322, lng: -81.6557 },
  { city: "Columbus", state: "OH", lat: 39.9612, lng: -82.9988 },
  { city: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194 },
  { city: "Indianapolis", state: "IN", lat: 39.7684, lng: -86.1581 },
  { city: "Washington", state: "DC", lat: 38.9072, lng: -77.0369 },
  { city: "Boston", state: "MA", lat: 42.3601, lng: -71.0589 },
  { city: "Portland", state: "OR", lat: 45.5152, lng: -122.6784 },
  { city: "Las Vegas", state: "NV", lat: 36.1699, lng: -115.1398 },
  { city: "Atlanta", state: "GA", lat: 33.749, lng: -84.388 },
  { city: "Miami", state: "FL", lat: 25.7617, lng: -80.1918 },
  { city: "Minneapolis", state: "MN", lat: 44.9778, lng: -93.265 },
  { city: "Tampa", state: "FL", lat: 27.9506, lng: -82.4572 },
  { city: "Salt Lake City", state: "UT", lat: 40.7608, lng: -111.891 },
  { city: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786 },
  { city: "Pittsburgh", state: "PA", lat: 40.4406, lng: -79.9959 },
  { city: "Detroit", state: "MI", lat: 42.3314, lng: -83.0458 },
  { city: "Sacramento", state: "CA", lat: 38.5816, lng: -121.4944 },
  { city: "Boise", state: "ID", lat: 43.615, lng: -116.2023 },
];

export const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

/** Kilometres → approximate degrees at a latitude. */
export function kmToDegrees(km: number, lat: number) {
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLng };
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
