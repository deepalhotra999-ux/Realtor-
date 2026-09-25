"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import {
  agentProfiles,
  auditLogs,
  featureFlags,
  features,
  listings,
  planEntitlements,
  plans,
  reports,
  reviews,
  sessions,
  subscriptions,
  users,
} from "@/server/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { invalidateFlagCache, updateSettings } from "@/server/settings";
import { sendEmail } from "@/server/notify";
import { refreshAgentRating } from "@/server/actions/marketplace";
import { getAI } from "@/providers";
import {
  aiSettingsSchema,
  generalSettingsSchema,
  monetizationSettingsSchema,
} from "@/lib/settings-schema";
import { LISTING_STATUSES } from "@/lib/domain";

export type AdminFormState = { ok?: boolean; error?: string; message?: string } | undefined;

async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  meta: Record<string, unknown> = {},
) {
  await getDb().insert(auditLogs).values({ actorId, action, targetType, targetId, meta });
}

const uuid = z.string().uuid();

/* ── Users ───────────────────────────────────────────────────────────────── */

export async function setUserRoleAction(userId: string, role: string) {
  const admin = await requireAdmin();
  const r = z.enum(["consumer", "agent", "broker", "property_manager", "admin"]).parse(role);
  const id = uuid.parse(userId);
  if (id === admin.id && r !== "admin") throw new Error("You can't remove your own admin role.");
  const db = getDb();
  await db.update(users).set({ role: r }).where(eq(users.id, id));
  if (r !== "consumer" && r !== "admin") {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
    await db
      .insert(agentProfiles)
      .values({
        userId: id,
        slug: `${u.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id.slice(0, 6)}`,
      })
      .onConflictDoNothing();
  }
  await audit(admin.id, "user.role", "user", id, { role: r });
  revalidatePath("/admin/users");
}

export async function setUserStatusAction(userId: string, status: string) {
  const admin = await requireAdmin();
  const s = z.enum(["active", "suspended", "pending"]).parse(status);
  const id = uuid.parse(userId);
  if (id === admin.id) throw new Error("You can't change your own status.");
  const db = getDb();
  await db.update(users).set({ status: s }).where(eq(users.id, id));
  if (s === "suspended") await db.delete(sessions).where(eq(sessions.userId, id));
  await audit(admin.id, "user.status", "user", id, { status: s });
  revalidatePath("/admin/users");
}

export async function setAgentVerifiedAction(userId: string, verified: boolean) {
  const admin = await requireAdmin();
  const id = uuid.parse(userId);
  await getDb().update(agentProfiles).set({ verified }).where(eq(agentProfiles.userId, id));
  await audit(admin.id, "agent.verify", "user", id, { verified });
  revalidatePath("/admin/agents");
}

/* ── Listings ────────────────────────────────────────────────────────────── */

export async function setListingStatusAction(listingId: string, status: string) {
  const admin = await requireAdmin();
  const s = z.enum(LISTING_STATUSES).parse(status);
  const id = uuid.parse(listingId);
  await getDb()
    .update(listings)
    .set({
      status: s,
      listedAt: s === "active" ? sql`coalesce(${listings.listedAt}, now())` : undefined,
    })
    .where(eq(listings.id, id));
  await audit(admin.id, "listing.status", "listing", id, { status: s });
  revalidatePath("/admin/listings");
}

export async function setListingFeaturedAction(listingId: string, featured: boolean) {
  const admin = await requireAdmin();
  const id = uuid.parse(listingId);
  await getDb()
    .update(listings)
    .set({
      isFeatured: featured,
      featuredUntil: featured ? new Date(Date.now() + 30 * 86_400_000) : null,
    })
    .where(eq(listings.id, id));
  await audit(admin.id, "listing.featured", "listing", id, { featured });
  revalidatePath("/admin/listings");
}

/* ── Moderation ──────────────────────────────────────────────────────────── */

export async function moderateReviewAction(reviewId: string, status: string) {
  const admin = await requireAdmin();
  const s = z.enum(["pending", "published", "flagged", "removed"]).parse(status);
  const id = uuid.parse(reviewId);
  const [r] = await getDb()
    .update(reviews)
    .set({ status: s })
    .where(eq(reviews.id, id))
    .returning({ agentId: reviews.agentId });
  if (r) await refreshAgentRating(r.agentId);
  await audit(admin.id, "review.moderate", "review", id, { status: s });
  revalidatePath("/admin/reviews");
}

export async function resolveReportAction(reportId: string, status: string, resolution?: string) {
  const admin = await requireAdmin();
  const s = z.enum(["open", "reviewing", "resolved", "dismissed"]).parse(status);
  const id = uuid.parse(reportId);
  await getDb()
    .update(reports)
    .set({
      status: s,
      resolvedById: ["resolved", "dismissed"].includes(s) ? admin.id : null,
      resolution: resolution ?? null,
    })
    .where(eq(reports.id, id));
  await audit(admin.id, "report.update", "report", id, { status: s });
  revalidatePath("/admin/reports");
}

/* ── Settings ────────────────────────────────────────────────────────────── */

const bool = (form: FormData, key: string) => form.get(key) === "on" || form.get(key) === "true";
const optInt = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? "").trim();
  return v === "" ? null : Math.max(0, Math.round(Number(v)));
};

export async function saveGeneralSettingsAction(
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = generalSettingsSchema.safeParse({
    siteName: form.get("siteName"),
    tagline: form.get("tagline"),
    supportEmail: form.get("supportEmail"),
    demoDataNotice: bool(form, "demoDataNotice"),
    allowRegistration: bool(form, "allowRegistration"),
    requireListingApproval: bool(form, "requireListingApproval"),
    requireReviewApproval: bool(form, "requireReviewApproval"),
    defaultMapCenter: {
      lat: Number(form.get("lat")),
      lng: Number(form.get("lng")),
      zoom: Number(form.get("zoom")),
    },
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  await updateSettings("general", parsed.data, admin.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "General settings saved." };
}

export async function saveMonetizationSettingsAction(
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = monetizationSettingsSchema.safeParse({
    subscriptionsEnabled: bool(form, "subscriptionsEnabled"),
    freeTrialEnabled: bool(form, "freeTrialEnabled"),
    trialDurationDays: Number(form.get("trialDurationDays") ?? 14),
    freeListingsLimit: optInt(form, "freeListingsLimit"),
    freeAgentAccounts: bool(form, "freeAgentAccounts"),
    paidFeatures: form.getAll("paidFeatures").map(String),
    aiFeaturesEnabled: bool(form, "aiFeaturesEnabled"),
    featuredListingsEnabled: bool(form, "featuredListingsEnabled"),
    advertisingEnabled: bool(form, "advertisingEnabled"),
    currency: String(form.get("currency") ?? "USD").toUpperCase(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  await updateSettings("monetization", parsed.data, admin.id);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: parsed.data.subscriptionsEnabled
      ? "Saved. Subscription system is ON."
      : "Saved. Everything is free (subscription system OFF).",
  };
}

export async function saveAISettingsAction(
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = aiSettingsSchema.safeParse({
    naturalLanguageSearch: bool(form, "naturalLanguageSearch"),
    homeFinder: bool(form, "homeFinder"),
    propertyQA: bool(form, "propertyQA"),
    listingDescriptions: bool(form, "listingDescriptions"),
    agentAssistant: bool(form, "agentAssistant"),
    comparisonSummaries: bool(form, "comparisonSummaries"),
    freeMonthlyRequests: optInt(form, "freeMonthlyRequests"),
    temperature: Number(form.get("temperature") ?? 0.2),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  await updateSettings("ai", parsed.data, admin.id);
  revalidatePath("/admin/ai");
  return { ok: true, message: "AI settings saved." };
}

export type AITestState =
  { ok?: boolean; error?: string; message?: string; output?: string } | undefined;

export async function testAIAction(_prev: AITestState, form: FormData): Promise<AITestState> {
  await requireAdmin();
  const prompt = z.string().trim().min(1).max(2000).safeParse(form.get("prompt"));
  if (!prompt.success) return { error: "Enter a prompt." };
  const ai = await getAI();
  const started = performance.now();
  try {
    const res = await ai.complete({
      messages: [{ role: "user", content: prompt.data }],
      maxTokens: 300,
    });
    return {
      ok: true,
      output: res.text,
      message: `${ai.name} · ${res.model} · ${Math.round(performance.now() - started)} ms`,
    };
  } catch (err) {
    return { error: `${ai.name} failed: ${(err as Error).message}` };
  }
}

export async function sendTestEmailAction(
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const to = z
    .string()
    .email()
    .safeParse(form.get("to") || admin.email);
  if (!to.success) return { error: "Enter a valid email." };
  const res = await sendEmail(
    to.data,
    "Dwellwise test email",
    "If you can read this, outbound email is configured correctly.",
    { label: "Open admin", href: "/admin/notifications" },
  );
  revalidatePath("/admin/notifications");
  return res.status === "failed"
    ? { error: `Delivery failed: ${"error" in res ? res.error : "unknown error"}` }
    : { ok: true, message: `Test email sent to ${to.data}.` };
}

/* ── Feature flags ───────────────────────────────────────────────────────── */

export async function toggleFlagAction(key: string, enabled: boolean) {
  const admin = await requireAdmin();
  await getDb().update(featureFlags).set({ enabled }).where(eq(featureFlags.key, key));
  invalidateFlagCache();
  await audit(admin.id, "flag.toggle", "flag", key, { enabled });
  revalidatePath("/admin/flags");
}

const flagSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,60}$/, "Use lowercase letters, numbers and underscores."),
  description: z.string().trim().max(200).default(""),
  rolloutPercent: z.coerce.number().int().min(0).max(100),
  roles: z.array(z.enum(["consumer", "agent", "broker", "property_manager", "admin"])).default([]),
});

export async function saveFlagAction(
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = flagSchema.safeParse({
    key: form.get("key"),
    description: form.get("description") ?? "",
    rolloutPercent: form.get("rolloutPercent") ?? 100,
    roles: form.getAll("roles").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await getDb()
    .insert(featureFlags)
    .values({ ...parsed.data, enabled: bool(form, "enabled") })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { ...parsed.data, enabled: bool(form, "enabled") },
    });
  invalidateFlagCache();
  await audit(admin.id, "flag.save", "flag", parsed.data.key, parsed.data);
  revalidatePath("/admin/flags");
  return { ok: true, message: `Saved “${parsed.data.key}”.` };
}

export async function deleteFlagAction(key: string) {
  const admin = await requireAdmin();
  await getDb().delete(featureFlags).where(eq(featureFlags.key, key));
  invalidateFlagCache();
  await audit(admin.id, "flag.delete", "flag", key);
  revalidatePath("/admin/flags");
}

/* ── Plans, entitlements & features ──────────────────────────────────────── */

const planSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,40}$/, "Plan key: lowercase letters, numbers, underscores."),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  audience: z.enum(["consumer", "agent", "broker", "property_manager"]),
  priceMonthly: z.coerce.number().min(0).max(1_000_000),
  priceAnnual: z.coerce.number().min(0).max(10_000_000),
  trialDays: z.coerce.number().int().min(0).max(365),
  sortOrder: z.coerce.number().int().default(0),
});

export async function savePlanAction(
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = planSchema.safeParse({
    id: form.get("id") || undefined,
    key: form.get("key"),
    name: form.get("name"),
    description: form.get("description") ?? "",
    audience: form.get("audience"),
    priceMonthly: form.get("priceMonthly"),
    priceAnnual: form.get("priceAnnual"),
    trialDays: form.get("trialDays"),
    sortOrder: form.get("sortOrder") ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const p = parsed.data;
  const db = getDb();
  const values = {
    key: p.key,
    name: p.name,
    description: p.description,
    audience: p.audience,
    // Admin enters major units; store minor units.
    priceMonthly: Math.round(p.priceMonthly * 100),
    priceAnnual: Math.round(p.priceAnnual * 100),
    trialDays: p.trialDays,
    sortOrder: p.sortOrder,
    isActive: bool(form, "isActive"),
    isPublic: bool(form, "isPublic"),
    isDefault: bool(form, "isDefault"),
    highlight: bool(form, "highlight"),
  };
  const clash = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.key, p.key), p.id ? ne(plans.id, p.id) : undefined))
    .limit(1);
  if (clash.length) return { error: "Another plan already uses that key." };

  let planId = p.id;
  if (planId) await db.update(plans).set(values).where(eq(plans.id, planId));
  else [{ id: planId }] = await db.insert(plans).values(values).returning({ id: plans.id });
  if (values.isDefault)
    await db.update(plans).set({ isDefault: false }).where(ne(plans.id, planId!));

  // Entitlements: ent.<featureKey>.enabled / ent.<featureKey>.limit
  const allFeatures = await db.select({ key: features.key }).from(features);
  await db.delete(planEntitlements).where(eq(planEntitlements.planId, planId!));
  const rows = allFeatures
    .filter((f) => bool(form, `ent.${f.key}.enabled`))
    .map((f) => ({
      planId: planId!,
      featureKey: f.key,
      enabled: true,
      limitValue: optInt(form, `ent.${f.key}.limit`),
    }));
  if (rows.length) await db.insert(planEntitlements).values(rows);

  await audit(admin.id, p.id ? "plan.update" : "plan.create", "plan", planId!, {
    key: p.key,
    entitlements: rows.length,
  });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: `Plan “${p.name}” saved with ${rows.length} entitlements.` };
}

export async function deletePlanAction(planId: string) {
  const admin = await requireAdmin();
  const id = uuid.parse(planId);
  const db = getDb();
  const [inUse] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.planId, id));
  if (inUse.n > 0) {
    // Keep history intact: archive instead of deleting.
    await db
      .update(plans)
      .set({ isActive: false, isPublic: false, isDefault: false })
      .where(eq(plans.id, id));
    await audit(admin.id, "plan.archive", "plan", id);
  } else {
    await db.delete(plans).where(eq(plans.id, id));
    await audit(admin.id, "plan.delete", "plan", id);
  }
  revalidatePath("/admin/plans");
}

const featureSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_.]{3,60}$/, "Feature key: lowercase, numbers, dots, underscores."),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).default(""),
  kind: z.enum(["boolean", "limit", "metered"]),
  unit: z.string().trim().max(30).optional(),
  category: z.string().trim().max(30).default("general"),
});

export async function saveFeatureAction(
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = featureSchema.safeParse({
    key: form.get("key"),
    name: form.get("name"),
    description: form.get("description") ?? "",
    kind: form.get("kind"),
    unit: form.get("unit") || undefined,
    category: form.get("category") || "general",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await getDb()
    .insert(features)
    .values({ ...parsed.data, unit: parsed.data.unit ?? null })
    .onConflictDoUpdate({
      target: features.key,
      set: { ...parsed.data, unit: parsed.data.unit ?? null },
    });
  await audit(admin.id, "feature.save", "feature", parsed.data.key);
  revalidatePath("/admin/plans");
  return { ok: true, message: `Feature “${parsed.data.name}” saved.` };
}

export async function deleteFeatureAction(key: string) {
  const admin = await requireAdmin();
  await getDb().delete(features).where(eq(features.key, key));
  await audit(admin.id, "feature.delete", "feature", key);
  revalidatePath("/admin/plans");
}

/* ── Subscriptions & trials ──────────────────────────────────────────────── */

export async function cancelSubscriptionAdminAction(subId: string, immediately: boolean) {
  const admin = await requireAdmin();
  const id = uuid.parse(subId);
  await getDb()
    .update(subscriptions)
    .set(
      immediately
        ? { status: "expired", canceledAt: new Date(), currentPeriodEnd: new Date() }
        : { status: "canceled", cancelAtPeriodEnd: true, canceledAt: new Date() },
    )
    .where(eq(subscriptions.id, id));
  await audit(admin.id, "subscription.cancel", "subscription", id, { immediately });
  revalidatePath("/admin/subscriptions");
}

export async function extendTrialAction(subId: string, days: number) {
  const admin = await requireAdmin();
  const id = uuid.parse(subId);
  const d = z.number().int().min(1).max(365).parse(days);
  await getDb()
    .update(subscriptions)
    .set({
      status: "trialing",
      trialEndsAt: sql`greatest(coalesce(${subscriptions.trialEndsAt}, now()), now()) + make_interval(days => ${d})`,
      currentPeriodEnd: sql`greatest(${subscriptions.currentPeriodEnd}, now()) + make_interval(days => ${d})`,
    })
    .where(eq(subscriptions.id, id));
  await audit(admin.id, "subscription.extend_trial", "subscription", id, { days: d });
  revalidatePath("/admin/subscriptions");
}

export async function grantPlanAction(
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email(),
      planId: z.string().uuid(),
      days: z.coerce.number().int().min(1).max(3650),
      asTrial: z.boolean(),
    })
    .safeParse({
      email: form.get("email"),
      planId: form.get("planId"),
      days: form.get("days"),
      asTrial: bool(form, "asTrial"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const db = getDb();
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`)
    .limit(1);
  if (!u) return { error: "No user with that email." };
  const end = new Date(Date.now() + parsed.data.days * 86_400_000);
  await db
    .update(subscriptions)
    .set({ status: "expired", currentPeriodEnd: new Date() })
    .where(
      and(
        eq(subscriptions.userId, u.id),
        inArray(subscriptions.status, ["trialing", "active", "past_due", "canceled"]),
      ),
    );
  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: u.id,
      planId: parsed.data.planId,
      status: parsed.data.asTrial ? "trialing" : "active",
      trialEndsAt: parsed.data.asTrial ? end : null,
      currentPeriodStart: new Date(),
      currentPeriodEnd: end,
      provider: "admin_grant",
    })
    .returning();
  await audit(admin.id, "subscription.grant", "subscription", sub.id, {
    email: parsed.data.email,
    days: parsed.data.days,
  });
  revalidatePath("/admin/subscriptions");
  return {
    ok: true,
    message: `Granted to ${parsed.data.email} until ${end.toLocaleDateString("en-US")}.`,
  };
}
