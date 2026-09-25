/**
 * Per-user notification preferences, stored under `users.preferences.notifications`.
 * Pure: parsing never throws and unknown/missing values fall back to defaults.
 */

export const NOTIFICATION_TYPES = {
  lead: {
    label: "New leads & inquiries",
    description: "When someone contacts you about a listing.",
  },
  tour: { label: "Tours", description: "Tour requests, confirmations and changes." },
  message: { label: "Messages", description: "New messages in your conversations." },
  alert: { label: "Saved-search alerts", description: "New homes matching your saved searches." },
  board: { label: "Shared boards", description: "Comments and homes added by co-searchers." },
  billing: { label: "Billing", description: "Receipts, trials and plan changes. Always emailed." },
  account: {
    label: "Account & security",
    description: "Verification results, warnings and access changes. Always emailed.",
  },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;
export type Channel = "email" | "inApp";
export const NOTIFICATION_TYPE_KEYS = Object.keys(NOTIFICATION_TYPES) as NotificationType[];

/** Transactional types that cannot be switched off by email. */
const REQUIRED_EMAIL: NotificationType[] = ["billing", "account"];

export type NotificationPrefs = Record<Channel, Record<NotificationType, boolean>>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email: {
    lead: true,
    tour: true,
    message: true,
    alert: true,
    board: false,
    billing: true,
    account: true,
  },
  inApp: {
    lead: true,
    tour: true,
    message: true,
    alert: true,
    board: true,
    billing: true,
    account: true,
  },
};

export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const out: NotificationPrefs = {
    email: { ...DEFAULT_NOTIFICATION_PREFS.email },
    inApp: { ...DEFAULT_NOTIFICATION_PREFS.inApp },
  };
  if (!raw || typeof raw !== "object") return out;
  for (const channel of ["email", "inApp"] as const) {
    const section = (raw as Record<string, unknown>)[channel];
    if (!section || typeof section !== "object") continue;
    for (const type of NOTIFICATION_TYPE_KEYS) {
      const v = (section as Record<string, unknown>)[type];
      if (typeof v === "boolean") out[channel][type] = v;
    }
  }
  for (const t of REQUIRED_EMAIL) out.email[t] = true;
  return out;
}

export function isRequiredEmail(type: string) {
  return (REQUIRED_EMAIL as string[]).includes(type);
}

/** Whether to deliver a notification of `type` on `channel`. Unknown types are delivered. */
export function wantsNotification(prefs: NotificationPrefs, type: string, channel: Channel) {
  if (!(type in NOTIFICATION_TYPES)) return true;
  if (channel === "email" && isRequiredEmail(type)) return true;
  return prefs[channel][type as NotificationType];
}
