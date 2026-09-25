/**
 * The catalogue of gateable capabilities. This is seed data for the `features`
 * table — admins can add more features in the admin panel, and code can check
 * any key. Nothing here decides *who* gets a feature; plans do that.
 */
export type FeatureKind = "boolean" | "limit" | "metered";

export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  kind: FeatureKind;
  unit?: string;
  category: "listings" | "leads" | "ai" | "crm" | "analytics" | "team" | "marketing" | "general";
}

export const FEATURES = {
  LISTINGS_ACTIVE: "listings.active",
  LISTINGS_FEATURED: "listings.featured",
  LEADS_MONTHLY: "leads.monthly",
  CRM: "crm.access",
  CRM_AUTOMATIONS: "crm.automations",
  ANALYTICS: "analytics.advanced",
  AI_REQUESTS: "ai.requests",
  AI_LISTING_WRITER: "ai.listing_writer",
  AI_AGENT_ASSISTANT: "ai.agent_assistant",
  TEAM_SEATS: "team.seats",
  MESSAGING: "messaging.access",
  TOURS: "tours.scheduling",
  ADS: "marketing.ads",
  BRANDING: "marketing.custom_branding",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES] | (string & {});

export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    key: FEATURES.LISTINGS_ACTIVE,
    name: "Active listings",
    description: "Number of listings that can be live at the same time.",
    kind: "limit",
    unit: "listings",
    category: "listings",
  },
  {
    key: FEATURES.LISTINGS_FEATURED,
    name: "Featured listings",
    description: "Promoted placement in search results and on the home page.",
    kind: "limit",
    unit: "listings",
    category: "listings",
  },
  {
    key: FEATURES.LEADS_MONTHLY,
    name: "Leads per month",
    description: "Inbound leads delivered to the account each month.",
    kind: "metered",
    unit: "leads",
    category: "leads",
  },
  {
    key: FEATURES.CRM,
    name: "Lead CRM",
    description: "Pipeline, activities, follow-ups and contact history.",
    kind: "boolean",
    category: "crm",
  },
  {
    key: FEATURES.CRM_AUTOMATIONS,
    name: "CRM automations",
    description: "Automatic follow-up reminders and lead routing.",
    kind: "boolean",
    category: "crm",
  },
  {
    key: FEATURES.ANALYTICS,
    name: "Advanced analytics",
    description: "Listing performance, market trends and lead conversion reports.",
    kind: "boolean",
    category: "analytics",
  },
  {
    key: FEATURES.AI_REQUESTS,
    name: "AI requests",
    description: "Monthly AI assistant, search and Q&A requests.",
    kind: "metered",
    unit: "requests",
    category: "ai",
  },
  {
    key: FEATURES.AI_LISTING_WRITER,
    name: "AI listing writer",
    description: "Generate listing descriptions from property facts.",
    kind: "boolean",
    category: "ai",
  },
  {
    key: FEATURES.AI_AGENT_ASSISTANT,
    name: "AI agent assistant",
    description: "Draft follow-ups and summarise leads.",
    kind: "boolean",
    category: "ai",
  },
  {
    key: FEATURES.TEAM_SEATS,
    name: "Team seats",
    description: "Members that can share a brokerage or team workspace.",
    kind: "limit",
    unit: "seats",
    category: "team",
  },
  {
    key: FEATURES.MESSAGING,
    name: "Messaging",
    description: "In-app conversations with buyers, renters and clients.",
    kind: "boolean",
    category: "general",
  },
  {
    key: FEATURES.TOURS,
    name: "Tour scheduling",
    description: "Accept and manage tour requests.",
    kind: "boolean",
    category: "general",
  },
  {
    key: FEATURES.ADS,
    name: "Advertising",
    description: "Sponsored placements across the marketplace.",
    kind: "boolean",
    category: "marketing",
  },
  {
    key: FEATURES.BRANDING,
    name: "Custom branding",
    description: "Brand colours and logo on listing pages.",
    kind: "boolean",
    category: "marketing",
  },
];
