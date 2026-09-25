import "server-only";
import { getDb } from "@/server/db";
import { aiRequests } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { assertCan, EntitlementError, recordUsage } from "@/server/entitlements";
import { getAI } from "@/providers";
import type { AIProvider, ChatMessage } from "@/providers/ai/types";
import { FEATURES } from "@/lib/entitlements/catalog";
import type { AISettings } from "@/lib/settings-schema";

export type AIFeature =
  | "naturalLanguageSearch"
  | "homeFinder"
  | "propertyQA"
  | "listingDescriptions"
  | "agentAssistant"
  | "comparisonSummaries";

export class AIFeatureDisabledError extends Error {
  constructor() {
    super("This AI feature is turned off.");
    this.name = "AIFeatureDisabledError";
  }
}

export interface AIContext {
  provider: AIProvider;
  settings: AISettings;
  /** Call the model; returns null (never throws) if it fails, so callers fall back. */
  llm: (
    messages: ChatMessage[],
    opts?: { json?: boolean; maxTokens?: number },
  ) => Promise<string | null>;
}

/**
 * Wraps an AI feature: checks the admin toggle + entitlements, meters usage,
 * logs latency/provider to `ai_requests`, and hands the feature a safe `llm()`.
 */
export async function runAI<T>(
  feature: AIFeature,
  userId: string | null,
  fn: (ctx: AIContext) => Promise<T>,
): Promise<T> {
  const settings = await getSettings("ai");
  if (!settings[feature]) throw new AIFeatureDisabledError();
  if (userId) await assertCan(userId, FEATURES.AI_REQUESTS);
  else {
    // Anonymous visitors can use AI unless AI is globally disabled.
    const monetization = await getSettings("monetization");
    if (!monetization.aiFeaturesEnabled) throw new AIFeatureDisabledError();
  }

  const provider = await getAI();
  const started = performance.now();
  let usedModel = false;
  let error: string | null = null;

  const ctx: AIContext = {
    provider,
    settings,
    llm: async (messages, opts) => {
      if (provider.kind !== "llm") return null;
      try {
        usedModel = true;
        const res = await provider.complete({
          messages,
          json: opts?.json,
          maxTokens: opts?.maxTokens,
          temperature: settings.temperature,
        });
        return res.text.trim() || null;
      } catch (err) {
        error = (err as Error).message;
        return null;
      }
    },
  };

  try {
    return await fn(ctx);
  } catch (err) {
    error = (err as Error).message;
    throw err;
  } finally {
    const latencyMs = Math.round(performance.now() - started);
    void getDb()
      .insert(aiRequests)
      .values({
        userId,
        feature,
        provider: usedModel ? provider.name : "rules",
        model: usedModel ? provider.model : "rules-v1",
        latencyMs,
        success: error === null,
        error,
      })
      .catch(() => {});
    if (userId) void recordUsage(userId, FEATURES.AI_REQUESTS).catch(() => {});
  }
}

export { EntitlementError };

/** Extract the first JSON object from model output (models sometimes wrap it in prose). */
export function extractJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
