/** Pure CRM vocabulary and helpers shared by the pro workspace and its tests. */

export const LEAD_STAGES = [
  "new",
  "contacted",
  "qualified",
  "touring",
  "offer",
  "under_contract",
  "closed_won",
  "closed_lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  touring: "Touring",
  offer: "Offer",
  under_contract: "Under contract",
  closed_won: "Closed · won",
  closed_lost: "Closed · lost",
};

/** Stages shown as pipeline columns (closed-lost is filtered separately). */
export const PIPELINE_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "touring",
  "offer",
  "under_contract",
  "closed_won",
];

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  listing_inquiry: "Listing inquiry",
  tour_request: "Tour request",
  agent_profile: "Profile contact",
  ai_assistant: "AI assistant",
  referral: "Referral",
  manual: "Added manually",
};

export const ACTIVITY_TYPES = ["note", "call", "email", "sms", "meeting", "task"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number] | "stage_change";

export function isClosed(stage: LeadStage) {
  return stage === "closed_won" || stage === "closed_lost";
}

/** Days until the next follow-up a stage calls for (null = none). */
export function followUpDaysFor(stage: LeadStage): number | null {
  switch (stage) {
    case "new":
      return 1;
    case "contacted":
      return 3;
    case "qualified":
      return 5;
    case "touring":
    case "offer":
      return 2;
    case "under_contract":
      return 7;
    default:
      return null;
  }
}

export interface FollowUpLead {
  name: string;
  stage: LeadStage;
  intent: "sale" | "rent" | null;
  message: string | null;
  listingTitle: string | null;
  lastContactAt: Date | null;
}

/**
 * Deterministic follow-up draft built only from CRM facts. Used as-is when no
 * model is available, and as the grounding draft the model may polish.
 */
export function draftFollowUp(lead: FollowUpLead, agentName: string, now = new Date()): string {
  const first = lead.name.split(/\s+/)[0] || lead.name;
  const home = lead.listingTitle ? `“${lead.listingTitle}”` : null;
  const renting = lead.intent === "rent";
  const quiet = lead.lastContactAt && now.getTime() - lead.lastContactAt.getTime() > 7 * 86_400_000;

  let body: string;
  switch (lead.stage) {
    case "new":
      body = home
        ? `Thanks for reaching out about ${home}. I'd be glad to answer any questions and set up a time for you to see it.`
        : `Thanks for getting in touch. I'd love to learn a little more about what you're looking for so I can help.`;
      break;
    case "contacted":
    case "qualified":
      body = `I wanted to follow up on your ${renting ? "rental" : "home"} search${home ? ` and ${home}` : ""}. Would you like me to send over a few more options that match what you described, or set up some showings this week?`;
      break;
    case "touring":
      body = `It was great to connect about ${home ?? "the homes you toured"}. What did you think? I'm happy to line up more tours or talk through next steps.`;
      break;
    case "offer":
      body = `Just checking in on the offer${home ? ` for ${home}` : ""}. I'll keep you posted the moment I hear back, and I'm here if any questions come up.`;
      break;
    case "under_contract":
      body = `Quick update check-in as we work toward closing${home ? ` on ${home}` : ""}. Let me know if anything comes up with inspections, financing or paperwork.`;
      break;
    default:
      body = `I hope you're settling in well. If you ever need anything, or know someone ${renting ? "looking for a rental" : "thinking of buying or selling"}, I'm always happy to help.`;
  }
  const opener = quiet
    ? `Hi ${first}, it's been a little while, so I wanted to check in.`
    : `Hi ${first},`;
  return `${opener}\n\n${body}\n\nBest,\n${agentName}`;
}
