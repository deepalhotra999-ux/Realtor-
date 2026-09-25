import "server-only";
import { z } from "zod";
import { AMENITY_KEYS, LISTING_TYPES, PROPERTY_TYPES } from "@/lib/domain";
import { parseNaturalLanguage, type ParsedSearch } from "@/lib/ai/nl-parser";
import { answerPropertyQuestion, listingFactSheet, type QAAnswer } from "@/lib/ai/property-qa";
import { compareListings } from "@/lib/ai/compare";
import { rankListings, type MatchResult, type Preferences } from "@/lib/ai/match";
import { DEFAULT_QUERY, type BBox, type SearchQuery } from "@/lib/search/query";
import type { ListingDetail, ListingSummary } from "@/lib/listing-types";
import { getGeocoding, getSearch } from "@/providers";
import { extractJson, runAI } from "./run";

const GROUNDING_RULES = `You are Dwellwise's real-estate assistant.
Rules you must follow:
- Use ONLY the facts provided in the FACTS block. Never invent numbers, features, policies, or neighborhood claims.
- If the facts don't contain the answer, say so plainly and suggest asking the listing agent.
- Do not give legal, financial, or safety opinions. Do not comment on protected characteristics of people or neighborhoods (fair housing).
- Be concise: at most 3 sentences.`;

/* ── Natural-language search ─────────────────────────────────────────────── */

const llmFilterSchema = z
  .object({
    listingType: z.enum(LISTING_TYPES).optional(),
    minPrice: z.number().int().positive().optional(),
    maxPrice: z.number().int().positive().optional(),
    minBeds: z.number().int().min(0).max(20).optional(),
    minBaths: z.number().min(0).max(20).optional(),
    minSqft: z.number().int().positive().optional(),
    propertyTypes: z.array(z.enum(PROPERTY_TYPES)).optional(),
    features: z.array(z.enum(AMENITY_KEYS as [string, ...string[]])).optional(),
    petsAllowed: z.boolean().optional(),
    place: z.string().max(80).optional(),
  })
  .partial();

export interface InterpretedSearch extends ParsedSearch {
  place?: { label: string; bbox?: BBox; lat: number; lng: number };
  usedModel: boolean;
}

export async function interpretSearch(
  text: string,
  userId: string | null,
): Promise<InterpretedSearch> {
  return runAI("naturalLanguageSearch", userId, async ({ llm }) => {
    const parsed = parseNaturalLanguage(text);
    let usedModel = false;

    // Only consult the model when the rules didn't understand most of the request.
    if (parsed.confidence < 0.6) {
      const out = await llm(
        [
          {
            role: "system",
            content: `Convert a home-search request into JSON filters. Allowed keys: listingType (sale|rent), minPrice, maxPrice, minBeds, minBaths, minSqft, propertyTypes (${PROPERTY_TYPES.join("|")}), features (${AMENITY_KEYS.join("|")}), petsAllowed, place (a city or neighborhood name exactly as written). Omit anything not stated. Respond with JSON only.`,
          },
          { role: "user", content: text },
        ],
        { json: true, maxTokens: 200 },
      );
      const validated = llmFilterSchema.safeParse(extractJson(out));
      if (validated.success) {
        usedModel = true;
        const { place, ...rest } = validated.data;
        // Rule-based values win; the model only fills gaps.
        for (const [k, v] of Object.entries(rest)) {
          const key = k as keyof ParsedSearch["filters"];
          if (parsed.filters[key] === undefined && v !== undefined)
            (parsed.filters as Record<string, unknown>)[key] = v;
        }
        if (!parsed.placeText && place) parsed.placeText = place;
      }
    }

    let place: InterpretedSearch["place"];
    if (parsed.placeText) {
      const [hit] = await getGeocoding().geocode(parsed.placeText, { limit: 1 });
      if (hit && hit.confidence >= 0.4)
        place = { label: hit.label, bbox: hit.bbox, lat: hit.lat, lng: hit.lng };
    }
    return { ...parsed, place, usedModel };
  });
}

/* ── Property Q&A ────────────────────────────────────────────────────────── */

export interface PropertyAnswer extends QAAnswer {
  provider: string;
}

export async function askAboutProperty(
  listing: ListingDetail,
  question: string,
  userId: string | null,
): Promise<PropertyAnswer> {
  return runAI("propertyQA", userId, async ({ llm, provider }) => {
    const rule = answerPropertyQuestion(listing, question);
    // Grounded rule answers are exact; out-of-scope refusals must stay refusals.
    if (rule.grounded || rule.answer.includes("rather not guess"))
      return { ...rule, provider: "rules" };

    const out = await llm(
      [
        { role: "system", content: GROUNDING_RULES },
        {
          role: "user",
          content: `FACTS:\n${JSON.stringify(listingFactSheet(listing))}\n\nQUESTION: ${question}`,
        },
      ],
      { maxTokens: 220 },
    );
    if (!out) return { ...rule, provider: "rules" };
    return { answer: out, sources: ["listing facts"], grounded: true, provider: provider.name };
  });
}

/* ── Comparison summary ──────────────────────────────────────────────────── */

export async function summarizeComparison(items: ListingSummary[], userId: string | null) {
  return runAI("comparisonSummaries", userId, async ({ llm, provider }) => {
    const computed = compareListings(items);
    if (items.length < 2)
      return { ...computed, narrative: null as string | null, provider: "rules" };
    const out = await llm(
      [
        {
          role: "system",
          content: `${GROUNDING_RULES}\nSummarise the trade-offs between these homes in 2–3 sentences for a buyer. Use only the COMPUTED DIFFERENCES.`,
        },
        { role: "user", content: `COMPUTED DIFFERENCES:\n- ${computed.bullets.join("\n- ")}` },
      ],
      { maxTokens: 180 },
    );
    return { ...computed, narrative: out, provider: out ? provider.name : "rules" };
  });
}

/* ── AI Home Finder ──────────────────────────────────────────────────────── */

export interface FinderTurn {
  role: "user" | "assistant";
  content: string;
}

export interface FinderResponse {
  reply: string;
  preferences: Preferences & { placeLabel?: string };
  chips: string[];
  missing: ("location" | "budget" | "bedrooms")[];
  results: { listing: ListingSummary; match: MatchResult }[];
  total: number;
  searchHref: string;
  provider: string;
}

function mergeParsed(turns: FinderTurn[]) {
  const merged: ParsedSearch["filters"] = {};
  let placeText: string | undefined;
  const chips: string[] = [];
  for (const t of turns.filter((t) => t.role === "user")) {
    const p = parseNaturalLanguage(t.content);
    Object.assign(merged, p.filters);
    if (p.filters.features && merged.features)
      merged.features = [...new Set([...(merged.features ?? []), ...p.filters.features])];
    if (p.placeText) placeText = p.placeText;
    chips.push(...p.chips);
  }
  return { filters: merged, placeText, chips: [...new Set(chips)].slice(-10) };
}

export async function runHomeFinder(
  turns: FinderTurn[],
  userId: string | null,
): Promise<FinderResponse> {
  return runAI("homeFinder", userId, async ({ llm, provider }) => {
    const { filters, placeText, chips } = mergeParsed(turns.slice(-12));
    let place: { label: string; bbox?: BBox; lat: number; lng: number } | undefined;
    if (placeText) {
      const [hit] = await getGeocoding().geocode(placeText, { limit: 1 });
      if (hit && hit.confidence >= 0.4)
        place = { label: hit.label, bbox: hit.bbox, lat: hit.lat, lng: hit.lng };
    }

    const missing: FinderResponse["missing"] = [];
    if (!place) missing.push("location");
    if (filters.maxPrice === undefined) missing.push("budget");
    if (filters.minBeds === undefined && !filters.propertyTypes?.includes("land"))
      missing.push("bedrooms");

    // Search wide (relax budget by 10% and drop amenities), then rank precisely.
    const query: SearchQuery = {
      ...DEFAULT_QUERY,
      listingType: filters.listingType ?? "sale",
      maxPrice: filters.maxPrice ? Math.round(filters.maxPrice * 1.1) : undefined,
      minPrice: filters.minPrice,
      minBeds: filters.minBeds,
      propertyTypes: filters.propertyTypes ?? [],
      bbox: place?.bbox,
      pageSize: 60,
    };
    const res = await getSearch().search(query);
    const prefs: Preferences = {
      listingType: query.listingType,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minBeds: filters.minBeds,
      minBaths: filters.minBaths,
      minSqft: filters.minSqft,
      propertyTypes: filters.propertyTypes,
      features: filters.features,
      petsAllowed: filters.petsAllowed,
      center: place
        ? { lat: place.lat, lng: place.lng, label: place.label.split(",")[0] }
        : undefined,
    };
    const results = rankListings(res.items, prefs).slice(0, 6);

    const params = new URLSearchParams();
    if (query.listingType === "rent") params.set("type", "rent");
    if (place) {
      params.set("place", place.label);
      if (place.bbox) params.set("bbox", place.bbox.map((n) => n.toFixed(5)).join(","));
    }
    if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
    if (filters.minPrice) params.set("minPrice", String(filters.minPrice));
    if (filters.minBeds !== undefined) params.set("beds", String(filters.minBeds));
    if (filters.propertyTypes?.length) params.set("types", filters.propertyTypes.join(","));
    if (filters.features?.length) params.set("features", filters.features.join(","));

    // Deterministic reply, grounded in counts we actually computed.
    const follow: Record<string, string> = {
      location: "Which city or neighborhood should I focus on?",
      budget:
        query.listingType === "rent" ? "What's your monthly budget?" : "What's your top budget?",
      bedrooms: "How many bedrooms do you need?",
    };
    let reply: string;
    if (!turns.some((t) => t.role === "user")) {
      reply =
        "Tell me about the home you're picturing — where, your budget, and what matters most.";
    } else if (results.length === 0) {
      reply = `I couldn't find active listings matching all of that${place ? ` in ${place.label.split(",")[0]}` : ""}. Try raising the budget or relaxing a must-have.`;
    } else {
      const top = results[0];
      reply = `I found ${res.total} home${res.total === 1 ? "" : "s"}${place ? ` around ${place.label.split(",")[0]}` : ""}. The closest match scores ${top.match.score}/100${top.match.reasons[0] ? ` — ${top.match.reasons[0].toLowerCase()}` : ""}.`;
      if (missing.length) reply += ` ${follow[missing[0]]}`;
    }

    // Optional LLM polish of the reply, constrained to the computed facts.
    if (turns.some((t) => t.role === "user")) {
      const out = await llm(
        [
          {
            role: "system",
            content: `${GROUNDING_RULES}\nRewrite the DRAFT reply to sound warm and natural. Keep every number and fact exactly as given. Keep any question at the end.`,
          },
          { role: "user", content: `DRAFT: ${reply}` },
        ],
        { maxTokens: 160 },
      );
      if (out && out.length < 600) reply = out;
    }

    return {
      reply,
      preferences: { ...prefs, placeLabel: place?.label },
      chips,
      missing,
      results,
      total: res.total,
      searchHref: `/search?${params}`,
      provider: provider.kind === "llm" ? provider.name : "rules",
    };
  });
}
