import { AMENITIES, PROPERTY_TYPE_LABELS, type AmenityKey } from "@/lib/domain";
import {
  daysSince,
  formatAcres,
  formatBaths,
  formatDate,
  formatNumber,
  formatPrice,
} from "@/lib/format";
import type { ListingDetail } from "@/lib/listing-types";

/**
 * Deterministic, grounded property Q&A. Answers come only from listing facts;
 * anything not in the data is reported as unknown — never guessed.
 */

export interface QAAnswer {
  answer: string;
  /** Fact keys the answer was derived from (shown as "Sources"). */
  sources: string[];
  /** false when the data doesn't contain the answer. */
  grounded: boolean;
}

const UNKNOWN = (topic: string): QAAnswer => ({
  answer: `The listing data doesn't include ${topic}. I'd rather not guess — ask the listing agent to confirm.`,
  sources: [],
  grounded: false,
});

/** Topics we deliberately never answer from our own data. */
const OUT_OF_SCOPE: [RegExp, string][] = [
  [/\b(crime|safe|safety|dangerous)\b/, "crime or safety statistics"],
  [/\b(commute|traffic|drive time|how far)\b/, "commute times"],
  [/\b(noise|noisy|loud|quiet)\b/, "noise levels"],
  [/\b(flood|fire risk|earthquake|hazard)\b/, "natural hazard risk"],
  [/\b(neighbou?rs?|who lives)\b/, "information about neighbors"],
  [/\b(worth|appreciat|investment|good deal|overpriced|underpriced)\b/, "a valuation opinion"],
  [
    /\b(inspection|foundation|roof age|mold|asbestos|lead paint)\b/,
    "inspection or condition details",
  ],
  [/\b(school rating|test scores|best school)\b/, "school ratings"],
];

function facts(l: ListingDetail) {
  return l.facts as Record<string, string | undefined>;
}

export function answerPropertyQuestion(
  l: ListingDetail,
  question: string,
  now = new Date(),
): QAAnswer {
  const q = question.toLowerCase();
  const f = facts(l);
  const typeLabel = PROPERTY_TYPE_LABELS[l.propertyType].toLowerCase();

  for (const [re, topic] of OUT_OF_SCOPE) if (re.test(q)) return UNKNOWN(topic);

  // Amenity questions: "is there a pool?", "does it have a garage?"
  for (const [key, label] of Object.entries(AMENITIES) as [AmenityKey, string][]) {
    const words = label.toLowerCase().replace(/'/g, "").split(" ");
    const hit =
      q.includes(label.toLowerCase()) ||
      q.includes(key.replace(/_/g, " ")) ||
      (words.length === 1 && new RegExp(`\\b${words[0]}s?\\b`).test(q));
    if (hit && !/\b(price|cost|hoa|tax)\b/.test(q)) {
      return l.features.includes(key)
        ? {
            answer: `Yes — the listing includes ${label.toLowerCase()}.`,
            sources: ["features"],
            grounded: true,
          }
        : {
            answer: `${label} isn't listed among this home's features. It may not have one — worth confirming with the agent.`,
            sources: ["features"],
            grounded: true,
          };
    }
  }

  if (/\b(pets?|dogs?|cats?)\b/.test(q)) {
    if (l.petsAllowed === true)
      return {
        answer: "Yes, pets are allowed according to the listing.",
        sources: ["petsAllowed"],
        grounded: true,
      };
    if (l.petsAllowed === false)
      return {
        answer: "The listing says pets are not allowed.",
        sources: ["petsAllowed"],
        grounded: true,
      };
    return UNKNOWN("a pet policy");
  }
  if (/\b(hoa|association|dues)\b/.test(q)) {
    if (l.hoaMonthly)
      return {
        answer: `HOA dues are ${formatPrice(l.hoaMonthly)} per month.`,
        sources: ["hoaMonthly"],
        grounded: true,
      };
    return l.listingType === "sale"
      ? { answer: "No HOA fee is listed for this home.", sources: ["hoaMonthly"], grounded: true }
      : UNKNOWN("HOA information");
  }
  if (/\b(tax|taxes)\b/.test(q)) {
    return l.taxAnnual
      ? {
          answer: `Annual property taxes are listed at ${formatPrice(l.taxAnnual)} (about ${formatPrice(Math.round(l.taxAnnual / 12))}/month).`,
          sources: ["taxAnnual"],
          grounded: true,
        }
      : UNKNOWN("property tax amounts");
  }
  if (/\b(deposit)\b/.test(q)) {
    return l.deposit
      ? {
          answer: `The security deposit is ${formatPrice(l.deposit)}.`,
          sources: ["deposit"],
          grounded: true,
        }
      : UNKNOWN("a deposit amount");
  }
  if (/\b(lease|term|how long)\b/.test(q) && l.listingType === "rent") {
    return l.leaseTermMonths
      ? {
          answer: `The lease term is ${l.leaseTermMonths} months.`,
          sources: ["leaseTermMonths"],
          grounded: true,
        }
      : UNKNOWN("the lease term");
  }
  if (/\b(available|move[- ]in|when can)\b/.test(q)) {
    if (l.availableFrom)
      return {
        answer: `It's available from ${formatDate(l.availableFrom)}.`,
        sources: ["availableFrom"],
        grounded: true,
      };
    if (l.status === "active")
      return {
        answer: `It's actively listed ${l.listingType === "rent" ? "for rent" : "for sale"}. No specific availability date is listed.`,
        sources: ["status"],
        grounded: true,
      };
    return {
      answer: `Its current status is "${l.status.replace("_", " ")}".`,
      sources: ["status"],
      grounded: true,
    };
  }
  if (/\b(furnished)\b/.test(q)) {
    if (l.furnished === null) return UNKNOWN("whether it's furnished");
    return {
      answer: l.furnished ? "Yes, it's listed as furnished." : "It's listed as unfurnished.",
      sources: ["furnished"],
      grounded: true,
    };
  }
  if (/\b(open house|showing|tour|visit|see it)\b/.test(q)) {
    const upcoming = l.openHouses.filter((o) => new Date(o.startsAt) > now);
    if (upcoming.length) {
      const o = upcoming[0];
      return {
        answer: `There's an open house ${formatDate(o.startsAt, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. You can also request a private tour from this page.`,
        sources: ["openHouses"],
        grounded: true,
      };
    }
    return {
      answer:
        "No open house is scheduled, but you can request a private or video tour from this page.",
      sources: ["openHouses"],
      grounded: true,
    };
  }
  if (/\b(price history|price cut|reduced|drop|dropped|changed)\b/.test(q)) {
    const changes = l.priceHistory.filter((h) => h.event === "price_change");
    if (!changes.length)
      return {
        answer: `No price changes are recorded — it was listed at ${formatPrice(l.priceHistory[0]?.price ?? l.price, l.listingType)}.`,
        sources: ["priceHistory"],
        grounded: true,
      };
    const first = l.priceHistory[0];
    return {
      answer: `Listed at ${formatPrice(first.price, l.listingType)}, now ${formatPrice(l.price, l.listingType)} after ${changes.length} change${changes.length > 1 ? "s" : ""} (latest ${formatDate(changes.at(-1)!.occurredAt)}).`,
      sources: ["priceHistory"],
      grounded: true,
    };
  }
  if (/\b(days on market|how long.*(listed|market)|when.*listed|listed when)\b/.test(q)) {
    const d = daysSince(l.listedAt, now);
    return d !== null
      ? {
          answer: `It was listed ${d} day${d === 1 ? "" : "s"} ago (${formatDate(l.listedAt!)}).`,
          sources: ["listedAt"],
          grounded: true,
        }
      : UNKNOWN("a listing date");
  }
  if (/\b(price per|\/ ?sq|per square|ppsf)\b/.test(q)) {
    return l.sqft
      ? {
          answer: `That works out to about ${formatPrice(Math.round(l.price / l.sqft))} per square foot.`,
          sources: ["price", "sqft"],
          grounded: true,
        }
      : UNKNOWN("square footage");
  }
  if (/\b(price|cost|how much|asking|rent)\b/.test(q)) {
    return {
      answer: `The ${l.listingType === "rent" ? "monthly rent" : "asking price"} is ${formatPrice(l.price, l.listingType)}.`,
      sources: ["price"],
      grounded: true,
    };
  }
  if (/\b(bed|bedrooms?)\b/.test(q))
    return l.beds !== null
      ? {
          answer: `It has ${l.beds === 0 ? "a studio layout" : `${l.beds} bedroom${l.beds === 1 ? "" : "s"}`}.`,
          sources: ["beds"],
          grounded: true,
        }
      : UNKNOWN("a bedroom count");
  if (/\b(bath|bathrooms?)\b/.test(q))
    return l.baths !== null
      ? { answer: `It has ${formatBaths(l.baths)} bathrooms.`, sources: ["baths"], grounded: true }
      : UNKNOWN("a bathroom count");
  if (/\b(lot|land|acre|yard size)\b/.test(q)) {
    const acres = formatAcres(l.lotSqft);
    return acres
      ? { answer: `The lot is ${acres}.`, sources: ["lotSqft"], grounded: true }
      : UNKNOWN("lot size");
  }
  if (/\b(sq ?ft|square|size|big|how large)\b/.test(q))
    return l.sqft
      ? { answer: `It's ${formatNumber(l.sqft)} square feet.`, sources: ["sqft"], grounded: true }
      : UNKNOWN("square footage");
  if (/\b(built|year|age|old|new)\b/.test(q)) {
    if (!l.yearBuilt) return UNKNOWN("the year built");
    return {
      answer: `It was built in ${l.yearBuilt} (${now.getUTCFullYear() - l.yearBuilt} years ago).`,
      sources: ["yearBuilt"],
      grounded: true,
    };
  }
  if (/\b(parking|park|car|garage)\b/.test(q)) {
    if (l.garageSpaces)
      return {
        answer: `It has a ${l.garageSpaces}-car garage.`,
        sources: ["garageSpaces"],
        grounded: true,
      };
    if (f.parking)
      return { answer: `Parking: ${f.parking}.`, sources: ["facts.parking"], grounded: true };
    return UNKNOWN("parking details");
  }
  if (/\b(heat|heating|furnace)\b/.test(q))
    return f.heating
      ? { answer: `Heating: ${f.heating}.`, sources: ["facts.heating"], grounded: true }
      : UNKNOWN("heating details");
  if (/\b(cool|cooling|air|a\/c|ac)\b/.test(q))
    return f.cooling
      ? { answer: `Cooling: ${f.cooling}.`, sources: ["facts.cooling"], grounded: true }
      : UNKNOWN("cooling details");
  if (/\b(floor|floors|flooring|carpet)\b/.test(q))
    return f.flooring
      ? { answer: `Flooring: ${f.flooring}.`, sources: ["facts.flooring"], grounded: true }
      : UNKNOWN("flooring details");
  if (/\b(school|district)\b/.test(q))
    return f.schoolDistrict
      ? {
          answer: `It's in ${f.schoolDistrict}. School ratings aren't included in the listing data.`,
          sources: ["facts.schoolDistrict"],
          grounded: true,
        }
      : UNKNOWN("school information");
  if (/\b(stories|storeys|levels|floors)\b/.test(q))
    return l.stories
      ? {
          answer: `It has ${l.stories} stor${l.stories === 1 ? "y" : "ies"}.`,
          sources: ["stories"],
          grounded: true,
        }
      : UNKNOWN("the number of stories");
  if (/\b(neighbou?rhood|area|where|location|address)\b/.test(q)) {
    return {
      answer: `It's at ${l.street}${l.unit ? ` ${l.unit}` : ""} in ${l.neighborhood ? `${l.neighborhood}, ` : ""}${l.city}, ${l.state} ${l.postalCode}.`,
      sources: ["address"],
      grounded: true,
    };
  }
  if (/\b(agent|contact|call|email|realtor|who)\b/.test(q)) {
    return l.agent
      ? {
          answer: `It's listed by ${l.agent.name}${l.agent.brokerageName ? ` of ${l.agent.brokerageName}` : ""}. Use the contact form on this page to reach them.`,
          sources: ["agent"],
          grounded: true,
        }
      : UNKNOWN("a listing agent");
  }
  if (/\b(feature|amenit|highlight|special|what.*(has|have|include))\b/.test(q)) {
    const labels = l.features.map((k) => AMENITIES[k as AmenityKey]).filter(Boolean);
    return labels.length
      ? { answer: `Listed features: ${labels.join(", ")}.`, sources: ["features"], grounded: true }
      : UNKNOWN("a feature list");
  }
  if (/\b(type|kind of|what is it)\b/.test(q))
    return { answer: `It's a ${typeLabel}.`, sources: ["propertyType"], grounded: true };

  return {
    answer: `I can answer questions about this ${typeLabel}'s price, size, rooms, fees, features, parking, pets, availability and price history — all from the listing data. Could you rephrase?`,
    sources: [],
    grounded: false,
  };
}

/** Compact fact sheet handed to an LLM — the only information it may use. */
export function listingFactSheet(l: ListingDetail) {
  return {
    address: `${l.street}${l.unit ? ` ${l.unit}` : ""}, ${l.neighborhood ? `${l.neighborhood}, ` : ""}${l.city}, ${l.state} ${l.postalCode}`,
    listingType: l.listingType,
    status: l.status,
    price: l.price,
    propertyType: PROPERTY_TYPE_LABELS[l.propertyType],
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    lotSqft: l.lotSqft,
    yearBuilt: l.yearBuilt,
    stories: l.stories,
    garageSpaces: l.garageSpaces,
    hoaMonthly: l.hoaMonthly,
    taxAnnual: l.taxAnnual,
    features: l.features.map((k) => AMENITIES[k as AmenityKey] ?? k),
    facts: l.facts,
    petsAllowed: l.petsAllowed,
    furnished: l.furnished,
    availableFrom: l.availableFrom,
    leaseTermMonths: l.leaseTermMonths,
    deposit: l.deposit,
    listedAt: l.listedAt,
    priceHistory: l.priceHistory,
    openHouses: l.openHouses,
    description: l.description,
    agent: l.agent ? { name: l.agent.name, brokerage: l.agent.brokerageName } : null,
  };
}
