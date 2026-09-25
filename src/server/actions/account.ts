"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { notifications, users } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { getGeocoding } from "@/providers";
import { AMENITY_KEYS, PROPERTY_TYPES } from "@/lib/domain";
import { NOTIFICATION_TYPE_KEYS, parseNotificationPrefs } from "@/lib/notification-prefs";

export type AccountFormState = { ok?: boolean; error?: string; message?: string } | undefined;

/** Merge one key into users.preferences without clobbering the others. */
async function setPreference(userId: string, key: string, value: unknown) {
  await getDb()
    .update(users)
    .set({
      preferences: sql`coalesce(${users.preferences}, '{}'::jsonb) || jsonb_build_object(${key}::text, ${JSON.stringify(value)}::jsonb)`,
    })
    .where(eq(users.id, userId));
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser("/notifications");
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function saveNotificationPrefsAction(
  _prev: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  const user = await requireUser("/notifications");
  const raw = { email: {} as Record<string, boolean>, inApp: {} as Record<string, boolean> };
  for (const t of NOTIFICATION_TYPE_KEYS) {
    raw.email[t] = form.get(`email.${t}`) === "on";
    raw.inApp[t] = form.get(`inApp.${t}`) === "on";
  }
  await setPreference(user.id, "notifications", parseNotificationPrefs(raw));
  revalidatePath("/notifications");
  return { ok: true, message: "Preferences saved." };
}

const optInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().min(0).optional(),
);

export async function saveHomePreferencesAction(
  _prev: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  const user = await requireUser("/for-you");
  const parsed = z
    .object({
      listingType: z.enum(["sale", "rent"]).optional(),
      minPrice: optInt,
      maxPrice: optInt,
      minBeds: optInt,
      minBaths: optInt,
      propertyTypes: z.array(z.enum(PROPERTY_TYPES)).default([]),
      features: z
        .array(z.enum(AMENITY_KEYS as [string, ...string[]]))
        .max(8)
        .default([]),
      place: z.string().trim().max(100).optional(),
    })
    .safeParse({
      listingType: form.get("listingType") || undefined,
      minPrice: form.get("minPrice"),
      maxPrice: form.get("maxPrice"),
      minBeds: form.get("minBeds"),
      minBaths: form.get("minBaths"),
      propertyTypes: form.getAll("propertyTypes").map(String),
      features: form.getAll("features").map(String),
      place: form.get("place") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { place, ...prefs } = parsed.data;
  if (prefs.minPrice && prefs.maxPrice && prefs.minPrice > prefs.maxPrice)
    return { error: "The minimum price is above the maximum." };

  let center: { lat: number; lng: number; label: string } | undefined;
  if (place) {
    const [hit] = await getGeocoding()
      .geocode(place, { limit: 1 })
      .catch(() => []);
    if (!hit || hit.confidence < 0.4)
      return { error: `We couldn't find “${place}”. Try a city name.` };
    center = { lat: hit.lat, lng: hit.lng, label: hit.label.split(",")[0] };
  }
  await setPreference(user.id, "home", { ...prefs, ...(center ? { center } : {}) });
  revalidatePath("/for-you");
  return { ok: true, message: "Saved. Your matches are updated." };
}

export async function clearHomePreferencesAction() {
  const user = await requireUser("/for-you");
  await getDb()
    .update(users)
    .set({ preferences: sql`coalesce(${users.preferences}, '{}'::jsonb) - 'home'` })
    .where(eq(users.id, user.id));
  revalidatePath("/for-you");
}
