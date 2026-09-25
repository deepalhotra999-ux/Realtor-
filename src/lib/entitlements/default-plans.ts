import { FEATURES } from "./catalog";

/**
 * Starter plan templates inserted by the seed script. They are ordinary rows —
 * admins edit prices, trials and entitlements (or delete them) in
 * Admin → Plans. With the subscription system OFF (default) none are enforced.
 */
export interface PlanTemplate {
  key: string;
  name: string;
  description: string;
  audience: "consumer" | "agent" | "broker" | "property_manager";
  priceMonthly: number;
  priceAnnual: number;
  trialDays: number;
  isDefault?: boolean;
  highlight?: boolean;
  entitlements: Record<string, number | null | boolean>;
}

export const DEFAULT_PLANS: PlanTemplate[] = [
  {
    key: "starter",
    name: "Starter",
    description: "Everything you need to list a few homes and respond to buyers.",
    audience: "agent",
    priceMonthly: 0,
    priceAnnual: 0,
    trialDays: 0,
    isDefault: true,
    entitlements: {
      [FEATURES.LISTINGS_ACTIVE]: 3,
      [FEATURES.LEADS_MONTHLY]: 25,
      [FEATURES.AI_REQUESTS]: 50,
      [FEATURES.MESSAGING]: true,
      [FEATURES.TOURS]: true,
      [FEATURES.CRM]: true,
    },
  },
  {
    key: "agent_pro",
    name: "Agent Pro",
    description: "For active agents who want more listings, AI tools and analytics.",
    audience: "agent",
    priceMonthly: 4900,
    priceAnnual: 49000,
    trialDays: 14,
    highlight: true,
    entitlements: {
      [FEATURES.LISTINGS_ACTIVE]: 40,
      [FEATURES.LISTINGS_FEATURED]: 3,
      [FEATURES.LEADS_MONTHLY]: null,
      [FEATURES.CRM]: true,
      [FEATURES.CRM_AUTOMATIONS]: true,
      [FEATURES.ANALYTICS]: true,
      [FEATURES.AI_REQUESTS]: 1000,
      [FEATURES.AI_LISTING_WRITER]: true,
      [FEATURES.AI_AGENT_ASSISTANT]: true,
      [FEATURES.MESSAGING]: true,
      [FEATURES.TOURS]: true,
    },
  },
  {
    key: "team",
    name: "Team",
    description: "Shared pipeline and listings for small teams.",
    audience: "broker",
    priceMonthly: 14900,
    priceAnnual: 149000,
    trialDays: 14,
    entitlements: {
      [FEATURES.LISTINGS_ACTIVE]: 150,
      [FEATURES.LISTINGS_FEATURED]: 10,
      [FEATURES.LEADS_MONTHLY]: null,
      [FEATURES.CRM]: true,
      [FEATURES.CRM_AUTOMATIONS]: true,
      [FEATURES.ANALYTICS]: true,
      [FEATURES.AI_REQUESTS]: 5000,
      [FEATURES.AI_LISTING_WRITER]: true,
      [FEATURES.AI_AGENT_ASSISTANT]: true,
      [FEATURES.TEAM_SEATS]: 8,
      [FEATURES.MESSAGING]: true,
      [FEATURES.TOURS]: true,
      [FEATURES.BRANDING]: true,
    },
  },
  {
    key: "brokerage",
    name: "Brokerage",
    description: "Unlimited listings and seats with brokerage-wide reporting.",
    audience: "broker",
    priceMonthly: 49900,
    priceAnnual: 499000,
    trialDays: 30,
    entitlements: {
      [FEATURES.LISTINGS_ACTIVE]: null,
      [FEATURES.LISTINGS_FEATURED]: 50,
      [FEATURES.LEADS_MONTHLY]: null,
      [FEATURES.CRM]: true,
      [FEATURES.CRM_AUTOMATIONS]: true,
      [FEATURES.ANALYTICS]: true,
      [FEATURES.AI_REQUESTS]: null,
      [FEATURES.AI_LISTING_WRITER]: true,
      [FEATURES.AI_AGENT_ASSISTANT]: true,
      [FEATURES.TEAM_SEATS]: null,
      [FEATURES.MESSAGING]: true,
      [FEATURES.TOURS]: true,
      [FEATURES.BRANDING]: true,
      [FEATURES.ADS]: true,
    },
  },
  {
    key: "manager",
    name: "Property Manager",
    description: "Rental listings, tenant leads and tour scheduling at scale.",
    audience: "property_manager",
    priceMonthly: 7900,
    priceAnnual: 79000,
    trialDays: 14,
    entitlements: {
      [FEATURES.LISTINGS_ACTIVE]: 250,
      [FEATURES.LEADS_MONTHLY]: null,
      [FEATURES.CRM]: true,
      [FEATURES.ANALYTICS]: true,
      [FEATURES.AI_REQUESTS]: 2000,
      [FEATURES.AI_LISTING_WRITER]: true,
      [FEATURES.MESSAGING]: true,
      [FEATURES.TOURS]: true,
    },
  },
];
