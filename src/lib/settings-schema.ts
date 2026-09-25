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

const limitSchema = z.number().int().min(0).nullable();

/** Per-tier activity caps. null = unlimited. */
export const activityLimitsSchema = z.object({
  activeListings: limitSchema,
  messagesPerDay: limitSchema,
  contactsPerDay: limitSchema,
  linksPerMessage: limitSchema,
  activePromotions: limitSchema,
  actionsPerDay: limitSchema,
});
export type ActivityLimits = z.infer<typeof activityLimitsSchema>;

export const STRIKE_ACTIONS = ["warn", "restrict", "suspend", "ban"] as const;
export const RESTRICTABLE_FEATURES = [
  "listings",
  "messaging",
  "contact",
  "reviews",
  "promotions",
  "leads",
  "api",
] as const;
export type RestrictableFeature = (typeof RESTRICTABLE_FEATURES)[number];

export const strikeStepSchema = z.object({
  /** Applies when a user's active strike count reaches this number. */
  strikes: z.number().int().min(1).max(50),
  action: z.enum(STRIKE_ACTIONS),
  /** Duration for restrict/suspend; null = until an admin lifts it. */
  days: z.number().int().min(1).max(3650).nullable().default(null),
  features: z.array(z.enum(RESTRICTABLE_FEATURES)).default([]),
});
export type StrikeStep = z.infer<typeof strikeStepSchema>;

/**
 * Admin → Settings → Trust. Who may publish, verification rules, new-account
 * probation limits and the strike ladder. Nothing here is hard-coded elsewhere.
 */
export const trustSettingsSchema = z.object({
  /** Minimum verification level (0–3) to publish listings, per account type. */
  publishLevel: z
    .object({
      consumer: z.number().int().min(0).max(3).default(2),
      agent: z.number().int().min(0).max(3).default(1),
      broker: z.number().int().min(0).max(3).default(1),
      property_manager: z.number().int().min(0).max(3).default(1),
      developer: z.number().int().min(0).max(3).default(2),
    })
    .default({ consumer: 2, agent: 1, broker: 1, property_manager: 1, developer: 2 }),
  /** Let verified sellers (consumers at their publish level) list property themselves. */
  sellerListingsEnabled: z.boolean().default(true),
  /** Listings from accounts below this level wait in review before going live. */
  reviewListingsBelowLevel: z.number().int().min(0).max(4).default(2),
  /** Level 1 also needs a verified phone number. */
  requirePhoneForLevel1: z.boolean().default(false),
  /** Messaging/contacting/reviewing need a verified email. */
  requireEmailToInteract: z.boolean().default(true),
  verificationCodeTtlMinutes: z.number().int().min(2).max(120).default(15),
  verificationCodeMaxAttempts: z.number().int().min(1).max(20).default(5),
  /** Approved identity / license checks lapse after this many days (null = never). */
  identityValidDays: z.number().int().min(1).nullable().default(730),
  licenseValidDays: z.number().int().min(1).nullable().default(365),
  /** Uploaded verification documents are deleted this many days after review. */
  documentRetentionDays: z.number().int().min(0).max(365).default(30),
  /** Accounts younger than this (or below level 1) are on probation. */
  probationDays: z.number().int().min(0).max(365).default(14),
  probationLimits: activityLimitsSchema.default({
    activeListings: 1,
    messagesPerDay: 20,
    contactsPerDay: 10,
    linksPerMessage: 0,
    activePromotions: 0,
    actionsPerDay: 150,
  }),
  standardLimits: activityLimitsSchema.default({
    activeListings: 25,
    messagesPerDay: 200,
    contactsPerDay: 60,
    linksPerMessage: 3,
    activePromotions: 5,
    actionsPerDay: 2000,
  }),
  /** Verified sellers/agents (level ≥ 2). */
  trustedLimits: activityLimitsSchema.default({
    activeListings: null,
    messagesPerDay: 1000,
    contactsPerDay: 300,
    linksPerMessage: 10,
    activePromotions: null,
    actionsPerDay: null,
  }),
  strikesEnabled: z.boolean().default(true),
  /** Strikes older than this stop counting. */
  strikeWindowDays: z.number().int().min(1).max(3650).default(180),
  violationTypes: z
    .array(z.string().min(2).max(40))
    .default(["spam", "scam", "fake_listing", "harassment", "discrimination", "other"]),
  strikeLadder: z.array(strikeStepSchema).default([
    { strikes: 1, action: "warn", days: 30, features: [] },
    { strikes: 2, action: "restrict", days: 7, features: ["listings", "messaging"] },
    { strikes: 3, action: "suspend", days: 30, features: [] },
    { strikes: 5, action: "ban", days: null, features: [] },
  ]),
});
export type TrustSettings = z.infer<typeof trustSettingsSchema>;

export const SETTINGS_SECTIONS = {
  general: generalSettingsSchema,
  monetization: monetizationSettingsSchema,
  ai: aiSettingsSchema,
  automation: automationSettingsSchema,
  trust: trustSettingsSchema,
} as const;

export type SettingsSection = keyof typeof SETTINGS_SECTIONS;
export type SettingsOf<S extends SettingsSection> = z.infer<(typeof SETTINGS_SECTIONS)[S]>;

export function parseSettings<S extends SettingsSection>(section: S, raw: unknown): SettingsOf<S> {
  const schema = SETTINGS_SECTIONS[section];
  const result = schema.safeParse(raw ?? {});
  // Corrupt/partial rows never take the platform down: fall back to defaults.
  return (result.success ? result.data : schema.parse({})) as SettingsOf<S>;
}
