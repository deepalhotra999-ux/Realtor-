import type {
  ActivityLimits,
  RestrictableFeature,
  StrikeStep,
  TrustSettings,
} from "@/lib/settings-schema";

/** Pure trust rules: verification levels, publishing, limits, strikes. No I/O. */

export type Role = "consumer" | "agent" | "broker" | "property_manager" | "developer" | "admin";
export type AccountStatus =
  "active" | "pending" | "warned" | "restricted" | "suspended" | "banned" | "deleted";

export const VERIFICATION_LEVELS = [
  { level: 0, name: "Basic account", description: "Signed up." },
  {
    level: 1,
    name: "Verified contact",
    description: "Email (and phone, when required) confirmed.",
  },
  { level: 2, name: "Verified seller", description: "Identity checked." },
  {
    level: 3,
    name: "Verified professional",
    description: "Identity and professional license checked.",
  },
] as const;

const PROFESSIONAL: Role[] = ["agent", "broker", "property_manager", "developer"];

export interface VerificationFacts {
  role: Role;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityApproved: boolean;
  licenseApproved: boolean;
}

/** Levels are cumulative: each one requires everything below it. */
export function verificationLevel(
  f: VerificationFacts,
  s: Pick<TrustSettings, "requirePhoneForLevel1">,
) {
  const contact = f.emailVerified && (!s.requirePhoneForLevel1 || f.phoneVerified);
  if (!contact) return 0;
  if (!f.identityApproved) return 1;
  if (!PROFESSIONAL.includes(f.role) || !f.licenseApproved) return 2;
  return 3;
}

/**
 * Account capability shown to others. Verified badges appear only when the
 * corresponding checks have actually passed — never implied by role alone.
 */
export function accountCapability(role: Role, level: number) {
  if (role === "admin") return { key: "ADMIN", label: "Staff", verified: true };
  if (level >= 3 && (role === "agent" || role === "broker"))
    return {
      key: role === "agent" ? "VERIFIED_AGENT" : "VERIFIED_BROKER",
      label: role === "agent" ? "Verified agent" : "Verified broker",
      verified: true,
    };
  if (role === "property_manager")
    return {
      key: "PROPERTY_MANAGER",
      label: level >= 3 ? "Verified property manager" : "Property manager",
      verified: level >= 3,
    };
  if (role === "developer")
    return {
      key: "DEVELOPER",
      label: level >= 3 ? "Verified developer" : "Developer",
      verified: level >= 3,
    };
  if (level >= 2) return { key: "VERIFIED_SELLER", label: "Verified seller", verified: true };
  if (role === "agent" || role === "broker")
    return {
      key: role.toUpperCase(),
      label: role === "agent" ? "Agent (unverified)" : "Broker (unverified)",
      verified: false,
    };
  return { key: "CONSUMER", label: "Member", verified: false };
}

export type PublishDecision =
  | { allowed: true; needsReview: boolean }
  | { allowed: false; reason: "role" | "level"; requiredLevel: number };

/** May this account publish listings, and must they be reviewed first? */
export function publishDecision(
  role: Role,
  level: number,
  s: Pick<TrustSettings, "publishLevel" | "sellerListingsEnabled" | "reviewListingsBelowLevel">,
): PublishDecision {
  if (role === "admin") return { allowed: true, needsReview: false };
  if (role === "consumer" && !s.sellerListingsEnabled)
    return { allowed: false, reason: "role", requiredLevel: 4 };
  const required = s.publishLevel[role];
  if (level < required) return { allowed: false, reason: "level", requiredLevel: required };
  return { allowed: true, needsReview: level < s.reviewListingsBelowLevel };
}

/** Can this account use the listing workspace at all (even before publishing)? */
export function canUseListingWorkspace(
  role: Role,
  s: Pick<TrustSettings, "sellerListingsEnabled">,
) {
  return role !== "consumer" || s.sellerListingsEnabled;
}

export type LimitTier = "probation" | "standard" | "trusted";

export function limitTier(
  a: { createdAt: Date; level: number; role: Role },
  s: Pick<TrustSettings, "probationDays">,
  now = new Date(),
): LimitTier {
  if (a.role === "admin" || a.level >= 2) return "trusted";
  const ageDays = (now.getTime() - a.createdAt.getTime()) / 86_400_000;
  if (a.level < 1 || ageDays < s.probationDays) return "probation";
  return "standard";
}

export function limitsFor(tier: LimitTier, s: TrustSettings): ActivityLimits {
  return tier === "probation"
    ? s.probationLimits
    : tier === "standard"
      ? s.standardLimits
      : s.trustedLimits;
}

/** null limit = unlimited. */
export function withinLimit(used: number, limit: number | null, increment = 1) {
  return limit === null || used + increment <= limit;
}

const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]+\.(?:com|net|org|io|co|xyz|info|biz|link|me|app|site|online|top|ru|cn)\b(?:\/[^\s]*)?/gi;

/** Count links in user text (bare domains included — a common way around link filters). */
export function countLinks(text: string) {
  return text.match(URL_RE)?.length ?? 0;
}

/** Strike ladder: the step for the highest threshold reached, if any is exactly hit. */
export function strikeStep(activeStrikes: number, ladder: StrikeStep[]): StrikeStep | null {
  const steps = [...ladder].sort((a, b) => a.strikes - b.strikes);
  // Apply the step whose threshold equals the count; beyond the top step, keep applying the top one.
  const exact = steps.find((s) => s.strikes === activeStrikes);
  if (exact) return exact;
  const top = steps.at(-1);
  return top && activeStrikes > top.strikes ? top : null;
}

/** Statuses that block sign-in and hide the account's listings. */
export const BLOCKING_STATUSES: AccountStatus[] = ["suspended", "banned", "deleted"];

export function isBlocked(status: AccountStatus) {
  return BLOCKING_STATUSES.includes(status);
}

export const FEATURE_LABELS: Record<RestrictableFeature, string> = {
  listings: "creating and publishing listings",
  messaging: "sending messages",
  contact: "contacting agents and requesting tours",
  reviews: "writing reviews",
  promotions: "promoting listings",
  leads: "receiving new leads",
  api: "API access",
};
