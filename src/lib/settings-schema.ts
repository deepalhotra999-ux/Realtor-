import { z } from "zod";

/**
 * Platform-wide settings editable in Admin → Settings. Stored as one JSON
 * document per section in `app_settings`, always parsed through these schemas
 * so missing keys fall back to safe, free-first defaults.
 */

export const monetizationSettingsSchema = z.object({
  /** Master switch. OFF = the entire platform is free (no plans enforced). */
  subscriptionsEnabled: z.boolean().default(false),
  freeTrialEnabled: z.boolean().default(true),
  /** Default trial length when a plan does not define its own. */
  trialDurationDays: z.number().int().min(0).max(365).default(14),
  /** Active listings a user may publish without a paid plan. null = unlimited. */
  freeListingsLimit: z.number().int().min(0).nullable().default(null),
  /** Agents/brokers/property managers can create accounts without paying. */
  freeAgentAccounts: z.boolean().default(true),
  /**
   * Feature keys that require an entitlement from a plan when subscriptions
   * are ON. Every feature not listed here stays free.
   */
  paidFeatures: z.array(z.string()).default([]),
  /** Global kill switches, independent of plans. */
  aiFeaturesEnabled: z.boolean().default(true),
  featuredListingsEnabled: z.boolean().default(true),
  advertisingEnabled: z.boolean().default(false),
  currency: z.string().length(3).default("USD"),
});
export type MonetizationSettings = z.infer<typeof monetizationSettingsSchema>;

export const generalSettingsSchema = z.object({
  siteName: z.string().min(1).default("Dwellwise"),
  tagline: z.string().default("Find the place that fits your life."),
  supportEmail: z.string().default("support@dwellwise.local"),
  /** Show the "fictional demo data" notice across the marketplace. */
  demoDataNotice: z.boolean().default(true),
  allowRegistration: z.boolean().default(true),
  requireListingApproval: z.boolean().default(false),
  requireReviewApproval: z.boolean().default(true),
  defaultMapCenter: z
    .object({ lat: z.number(), lng: z.number(), zoom: z.number() })
    .default({ lat: 39.5, lng: -98.35, zoom: 4 }),
});
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

export const aiSettingsSchema = z.object({
  naturalLanguageSearch: z.boolean().default(true),
  homeFinder: z.boolean().default(true),
  propertyQA: z.boolean().default(true),
  listingDescriptions: z.boolean().default(true),
  agentAssistant: z.boolean().default(true),
  comparisonSummaries: z.boolean().default(true),
  /** Per-user monthly AI requests when subscriptions are OFF. null = unlimited. */
  freeMonthlyRequests: z.number().int().min(0).nullable().default(null),
  temperature: z.number().min(0).max(2).default(0.2),
});
export type AISettings = z.infer<typeof aiSettingsSchema>;

/**
 * Admin → Automation & Trust. Master switches for every background process.
 * Thresholds and rules for each system live in the `trust` section.
 */
export const automationSettingsSchema = z.object({
  autoModeration: z.boolean().default(true),
  duplicateDetection: z.boolean().default(true),
  autoRanking: z.boolean().default(true),
  listingExpiration: z.boolean().default(true),
  promotionExpiration: z.boolean().default(true),
  accountEnforcement: z.boolean().default(true),
  spamDetection: z.boolean().default(true),
  riskScoring: z.boolean().default(true),
  verificationRequirements: z.boolean().default(true),
  signupProtection: z.boolean().default(true),
  priceDropAlerts: z.boolean().default(true),
  savedSearchAlerts: z.boolean().default(true),
  notifications: z.boolean().default(true),
});
export type AutomationSettings = z.infer<typeof automationSettingsSchema>;

export const SETTINGS_SECTIONS = {
  general: generalSettingsSchema,
  monetization: monetizationSettingsSchema,
  ai: aiSettingsSchema,
  automation: automationSettingsSchema,
} as const;

export type SettingsSection = keyof typeof SETTINGS_SECTIONS;
export type SettingsOf<S extends SettingsSection> = z.infer<(typeof SETTINGS_SECTIONS)[S]>;

export function parseSettings<S extends SettingsSection>(section: S, raw: unknown): SettingsOf<S> {
  const schema = SETTINGS_SECTIONS[section];
  const result = schema.safeParse(raw ?? {});
  // Corrupt/partial rows never take the platform down: fall back to defaults.
  return (result.success ? result.data : schema.parse({})) as SettingsOf<S>;
}
