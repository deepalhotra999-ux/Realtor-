import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  parseNotificationPrefs,
  wantsNotification,
} from "./notification-prefs";

describe("notification preferences", () => {
  it("falls back to defaults for missing or malformed input", () => {
    expect(parseNotificationPrefs(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(parseNotificationPrefs("nope")).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(parseNotificationPrefs({ email: { lead: "yes" } }).email.lead).toBe(true);
  });

  it("applies stored booleans per channel", () => {
    const p = parseNotificationPrefs({ email: { alert: false }, inApp: { message: false } });
    expect(wantsNotification(p, "alert", "email")).toBe(false);
    expect(wantsNotification(p, "alert", "inApp")).toBe(true);
    expect(wantsNotification(p, "message", "inApp")).toBe(false);
  });

  it("always emails billing and delivers unknown types", () => {
    const p = parseNotificationPrefs({ email: { billing: false } });
    expect(p.email.billing).toBe(true);
    expect(wantsNotification(p, "billing", "email")).toBe(true);
    expect(wantsNotification(p, "something_new", "email")).toBe(true);
  });
});
