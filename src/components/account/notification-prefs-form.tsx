"use client";

import { useActionState } from "react";
import { saveNotificationPrefsAction } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATION_TYPE_KEYS,
  NOTIFICATION_TYPES,
  isRequiredEmail,
  type NotificationPrefs,
} from "@/lib/notification-prefs";

export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefs }) {
  const [state, action, pending] = useActionState(saveNotificationPrefsAction, undefined);
  return (
    <form action={action}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-left text-xs">
            <th className="pb-2 font-medium">Notify me about</th>
            <th className="w-20 pb-2 text-center font-medium">In app</th>
            <th className="w-20 pb-2 text-center font-medium">Email</th>
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_TYPE_KEYS.map((t) => (
            <tr key={t} className="border-line border-t">
              <td className="py-3 pr-3">
                <span className="block font-medium">{NOTIFICATION_TYPES[t].label}</span>
                <span className="text-muted text-xs">{NOTIFICATION_TYPES[t].description}</span>
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  name={`inApp.${t}`}
                  defaultChecked={prefs.inApp[t]}
                  className="accent-brand-600 size-4"
                  aria-label={`${NOTIFICATION_TYPES[t].label} in app`}
                />
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  name={`email.${t}`}
                  defaultChecked={prefs.email[t]}
                  disabled={isRequiredEmail(t)}
                  className="accent-brand-600 size-4 disabled:opacity-60"
                  aria-label={`${NOTIFICATION_TYPES[t].label} by email`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        {state?.message ? <p className="text-brand-700 text-sm">{state.message}</p> : null}
      </div>
    </form>
  );
}
