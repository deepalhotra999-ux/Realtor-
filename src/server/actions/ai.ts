"use server";

import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getListingDetail } from "@/server/listings";
import {
  askAboutProperty,
  runHomeFinder,
  summarizeComparison,
  type FinderTurn,
} from "@/server/ai/features";
import { AIFeatureDisabledError, EntitlementError } from "@/server/ai/run";
import { getSearch } from "@/providers";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof AIFeatureDisabledError || err instanceof EntitlementError)
    return { ok: false, error: err.message };
  console.error("[ai]", err);
  return { ok: false, error: "The assistant is unavailable right now. Please try again." };
}

export async function askPropertyAction(
  slug: string,
  question: string,
): Promise<Result<Awaited<ReturnType<typeof askAboutProperty>>>> {
  const q = z.string().trim().min(2).max(300).safeParse(question);
  if (!q.success) return { ok: false, error: "Ask a question about this home." };
  const listing = await getListingDetail(slug);
  if (!listing) return { ok: false, error: "Listing not found." };
  try {
    const user = await getCurrentUser();
    return { ok: true, data: await askAboutProperty(listing, q.data, user?.id ?? null) };
  } catch (err) {
    return toError(err);
  }
}

const turnsSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1000) }))
  .max(30);

export async function homeFinderAction(
  turns: FinderTurn[],
): Promise<Result<Awaited<ReturnType<typeof runHomeFinder>>>> {
  const parsed = turnsSchema.safeParse(turns);
  if (!parsed.success) return { ok: false, error: "Invalid conversation." };
  try {
    const user = await getCurrentUser();
    return { ok: true, data: await runHomeFinder(parsed.data, user?.id ?? null) };
  } catch (err) {
    return toError(err);
  }
}

export async function compareSummaryAction(
  ids: string[],
): Promise<Result<Awaited<ReturnType<typeof summarizeComparison>>>> {
  const parsed = z.array(z.string().uuid()).min(2).max(4).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Pick 2–4 homes to compare." };
  try {
    const user = await getCurrentUser();
    const items = await getSearch().byIds(parsed.data);
    return { ok: true, data: await summarizeComparison(items, user?.id ?? null) };
  } catch (err) {
    return toError(err);
  }
}
