import { AMENITIES, PROPERTY_TYPE_LABELS, isAmenity, type PropertyType } from "@/lib/domain";
import { formatAcres } from "@/lib/format";

/**
 * Facts the listing writer may use. The description is built only from these
 * fields — nothing about neighborhoods, schools or people is ever invented.
 */
export interface WriterFacts {
  listingType: "sale" | "rent";
  propertyType: PropertyType;
  city: string;
  state: string;
  neighborhood?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lotSqft?: number | null;
  yearBuilt?: number | null;
  garageSpaces?: number | null;
  features: string[];
  petsAllowed?: boolean | null;
  furnished?: boolean | null;
}

function amenityList(keys: string[]) {
  const names = keys.filter(isAmenity).map((k) => AMENITIES[k].toLowerCase());
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function draftListingDescription(f: WriterFacts): string {
  const type = PROPERTY_TYPE_LABELS[f.propertyType].toLowerCase();
  const where = f.neighborhood ? `${f.neighborhood}, ${f.city}` : f.city;
  const sentences: string[] = [];

  // Compound adjectives: "3-bedroom, 2.5-bath house".
  const size: string[] = [];
  if (f.beds) size.push(`${f.beds}-bedroom`);
  if (f.baths) size.push(`${Number.isInteger(f.baths) ? f.baths : f.baths.toFixed(1)}-bath`);
  const sizeText = size.length ? `${size.join(", ")} ` : "";
  sentences.push(
    `${f.listingType === "rent" ? "Available for rent" : "Welcome home"}: a ${sizeText}${type} in ${where}, ${f.state}.`,
  );

  const detail: string[] = [];
  if (f.sqft) detail.push(`${f.sqft.toLocaleString("en-US")} square feet of living space`);
  if (f.yearBuilt) detail.push(`was built in ${f.yearBuilt}`);
  const lot = formatAcres(f.lotSqft);
  if (lot && f.propertyType !== "condo" && f.propertyType !== "apartment")
    detail.push(`sits on ${lot.includes("lot") ? `a ${lot}` : lot}`);
  if (detail.length) {
    const [first, ...rest] = detail;
    const offers = first.startsWith("was") || first.startsWith("sits") ? first : `offers ${first}`;
    const tail = rest.length ? `${rest.length > 1 ? ", " : " and "}${rest.join(" and ")}` : "";
    sentences.push(`It ${offers}${tail}.`);
  }

  const top = f.features.filter(isAmenity).slice(0, 5);
  if (top.length) sentences.push(`Highlights include ${amenityList(top)}.`);
  if (f.garageSpaces) sentences.push(`Parking includes a ${f.garageSpaces}-car garage.`);

  if (f.listingType === "rent") {
    const terms: string[] = [];
    if (f.petsAllowed === true) terms.push("pets are welcome");
    if (f.petsAllowed === false) terms.push("no pets");
    if (f.furnished) terms.push("it comes furnished");
    if (terms.length) sentences.push(`Good to know: ${terms.join("; ")}.`);
  }

  sentences.push(
    f.listingType === "rent"
      ? "Reach out to schedule a showing."
      : "Contact the listing agent to arrange a private tour.",
  );
  return sentences.join(" ");
}
