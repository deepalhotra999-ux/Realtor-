import { hashString } from "@/lib/random";

export interface FlagRecord {
  key: string;
  enabled: boolean;
  rolloutPercent: number;
  roles: string[];
}

export interface FlagSubject {
  id?: string | null;
  role?: string | null;
}

/** Stable 0–99 bucket for a subject and flag, so rollouts don't flicker. */
export function rolloutBucket(flagKey: string, subjectId: string): number {
  return hashString(`${flagKey}:${subjectId}`) % 100;
}

/** Pure flag evaluation: on/off → role targeting → percentage rollout. */
export function evaluateFlag(flag: FlagRecord | undefined, subject: FlagSubject = {}): boolean {
  if (!flag || !flag.enabled) return false;
  if (flag.roles.length && (!subject.role || !flag.roles.includes(subject.role))) return false;
  if (flag.rolloutPercent >= 100) return true;
  if (flag.rolloutPercent <= 0) return false;
  // Anonymous visitors only see fully rolled-out flags.
  if (!subject.id) return false;
  return rolloutBucket(flag.key, subject.id) < flag.rolloutPercent;
}

/** Flags created on first boot. Admins manage them in Admin → Feature flags. */
export const DEFAULT_FLAGS: (FlagRecord & { description: string })[] = [
  {
    key: "ai_home_finder",
    description: "Conversational AI Home Finder",
    enabled: true,
    rolloutPercent: 100,
    roles: [],
  },
  {
    key: "collaborative_boards",
    description: "Shared home-search boards",
    enabled: true,
    rolloutPercent: 100,
    roles: [],
  },
  {
    key: "market_insights",
    description: "Market analytics pages",
    enabled: true,
    rolloutPercent: 100,
    roles: [],
  },
  {
    key: "personalized_matching",
    description: "Personalized 'For you' recommendations",
    enabled: true,
    rolloutPercent: 100,
    roles: [],
  },
  {
    key: "video_tours",
    description: "Offer video tours when scheduling",
    enabled: true,
    rolloutPercent: 100,
    roles: [],
  },
  {
    key: "new_listing_editor",
    description: "Next-generation listing editor (beta)",
    enabled: false,
    rolloutPercent: 25,
    roles: ["agent", "broker"],
  },
];
