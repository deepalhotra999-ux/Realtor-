"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import {
  agentProfiles,
  leadActivities,
  leads,
  listings,
  priceHistory,
  properties,
  propertyMedia,
  tours,
} from "@/server/db/schema";
import { requirePro, type SessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { assertCan, EntitlementError } from "@/server/entitlements";
import { notify, sendEmail } from "@/server/notify";
import { draftLeadFollowUp, writeListingDescription } from "@/server/ai/features";
import { AIFeatureDisabledError } from "@/server/ai/run";
import { getMyListing } from "@/server/pro/queries";
import { getGeocoding, getStorage } from "@/providers";
import { ALLOWED_UPLOAD_TYPES } from "@/providers/storage/types";
import { AMENITY_KEYS, LISTING_STATUSES, PROPERTY_TYPES } from "@/lib/domain";
import { FEATURES } from "@/lib/entitlements/catalog";
import { ACTIVITY_TYPES, followUpDaysFor, LEAD_STAGES, type LeadStage } from "@/lib/crm";
import type { WriterFacts } from "@/lib/ai/listing-writer";
import { listingSlug } from "@/lib/slug";

export type ProFormState = { ok?: boolean; error?: string; message?: string } | undefined;

const uuid = z.string().uuid();
const LIVE = ["active", "coming_soon", "pending"] as const;

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof EntitlementError || err instanceof AIFeatureDisabledError) return err.message;
  console.error("[pro]", err);
  return fallback;
}

/* ── Listings ────────────────────────────────────────────────────────────── */

const optNum = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0).optional(),
);
const optInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().min(0).optional(),
);
const optStr = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

const listingSchema = z.object({
  id: z.string().uuid().optional(),
  listingType: z.enum(["sale", "rent"]),
  propertyType: z.enum(PROPERTY_TYPES),
  title: z.string().trim().min(4, "Add a short title.").max(120),
  description: z.string().trim().max(5000).default(""),
  price: z.coerce.number().int().positive("Enter a price."),
  street: z.string().trim().min(3, "Enter the street address.").max(120),
  unit: optStr(20),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  state: z
    .string()
    .trim()
    .length(2, "Use the 2-letter state code.")
    .transform((s) => s.toUpperCase()),
  postalCode: z.string().trim().min(3, "Enter the ZIP code.").max(10),
  neighborhood: optStr(80),
  latitude: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().min(-180).max(180).optional(),
  ),
  beds: optInt,
  baths: optNum,
  sqft: optInt,
  lotSqft: optInt,
  yearBuilt: optInt,
  garageSpaces: optInt,
  hoaMonthly: optInt,
  taxAnnual: optInt,
  features: z.array(z.enum(AMENITY_KEYS as [string, ...string[]])).default([]),
  availableFrom: optStr(10),
  leaseTermMonths: optInt,
  deposit: optInt,
  petsAllowed: z.boolean().optional(),
  furnished: z.boolean().optional(),
});

function readListingForm(form: FormData) {
  const tri = (k: string) =>
    form.get(k) === "yes" ? true : form.get(k) === "no" ? false : undefined;
  return listingSchema.safeParse({
    ...Object.fromEntries(
      [...form.entries()].filter(([k]) => !["features", "petsAllowed", "furnished"].includes(k)),
    ),
    features: form.getAll("features").map(String),
    petsAllowed: tri("petsAllowed"),
    furnished: tri("furnished"),
  });
}

/** Whether a publish is allowed right now; returns the status to store. */
async function publishStatus(user: SessionUser, currentlyLive: boolean) {
  const general = await getSettings("general");
  if (general.requireListingApproval && user.role !== "admin") return "draft" as const;
  if (!currentlyLive) await assertCan(user.id, FEATURES.LISTINGS_ACTIVE);
  return "active" as const;
}

export async function saveListingAction(
  _prev: ProFormState,
  form: FormData,
): Promise<ProFormState> {
  const user = await requirePro();
  const parsed = readListingForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const intent = form.get("intent") === "publish" ? "publish" : "save";
  const db = getDb();

  const existing = d.id ? await getMyListing(user, d.id) : null;
  if (d.id && !existing) return { error: "Listing not found." };

  // Location: explicit coordinates win, then the existing point, then geocoding.
  let lat =
    d.latitude ?? (existing && !addressChanged(existing.p, d) ? existing.p.latitude : undefined);
  let lng =
    d.longitude ?? (existing && !addressChanged(existing.p, d) ? existing.p.longitude : undefined);
  if (lat === undefined || lng === undefined) {
    const [hit] = await getGeocoding()
      .geocode(`${d.street}, ${d.city}, ${d.state} ${d.postalCode}`, { limit: 1 })
      .catch(() => []);
    const [cityHit] = hit
      ? [hit]
      : await getGeocoding()
          .geocode(`${d.city}, ${d.state}`, { limit: 1 })
          .catch(() => []);
    if (!cityHit)
      return {
        error: "We couldn't place that address on the map. Enter latitude and longitude below.",
      };
    lat = cityHit.lat;
    lng = cityHit.lng;
  }

  const propertyValues = {
    propertyType: d.propertyType,
    street: d.street,
    unit: d.unit ?? null,
    city: d.city,
    state: d.state,
    postalCode: d.postalCode,
    neighborhood: d.neighborhood ?? null,
    latitude: lat,
    longitude: lng,
    location: { x: lng, y: lat },
    beds: d.beds ?? null,
    baths: d.baths ?? null,
    sqft: d.sqft ?? null,
    lotSqft: d.lotSqft ?? null,
    yearBuilt: d.yearBuilt ?? null,
    garageSpaces: d.garageSpaces ?? null,
    hoaMonthly: d.hoaMonthly ?? null,
    taxAnnual: d.taxAnnual ?? null,
    features: d.features,
  };
  const rental = d.listingType === "rent";
  const listingValues = {
    listingType: d.listingType,
    title: d.title,
    description: d.description,
    price: d.price,
    availableFrom: rental ? (d.availableFrom ?? null) : null,
    leaseTermMonths: rental ? (d.leaseTermMonths ?? null) : null,
    deposit: rental ? (d.deposit ?? null) : null,
    petsAllowed: rental ? (d.petsAllowed ?? null) : null,
    furnished: rental ? (d.furnished ?? null) : null,
  };

  let status: (typeof LISTING_STATUSES)[number] | undefined;
  try {
    if (intent === "publish")
      status = await publishStatus(
        user,
        (LIVE as readonly string[]).includes(existing?.l.status ?? ""),
      );
  } catch (err) {
    return { error: errorMessage(err, "Couldn't publish this listing.") };
  }

  let listingId: string;
  if (existing) {
    listingId = existing.l.id;
    await db.update(properties).set(propertyValues).where(eq(properties.id, existing.p.id));
    await db
      .update(listings)
      .set({
        ...listingValues,
        ...(status
          ? {
              status,
              listedAt:
                status === "active" ? (existing.l.listedAt ?? new Date()) : existing.l.listedAt,
            }
          : {}),
      })
      .where(eq(listings.id, listingId));
    if ((LIVE as readonly string[]).includes(existing.l.status) && existing.l.price !== d.price) {
      await db.insert(priceHistory).values({
        propertyId: existing.p.id,
        listingId,
        event: "price_change",
        price: d.price,
        occurredAt: new Date(),
      });
    }
    if (status === "active" && !existing.l.listedAt)
      await recordListed(existing.p.id, listingId, d.price);
  } else {
    const [profile] = await db
      .select({ brokerageId: agentProfiles.brokerageId })
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, user.id))
      .limit(1);
    const [p] = await db
      .insert(properties)
      .values({ ...propertyValues, source: "manual" })
      .returning({ id: properties.id });
    const [l] = await db
      .insert(listings)
      .values({
        ...listingValues,
        slug: listingSlug(d, randomUUID()),
        propertyId: p.id,
        status: status ?? "draft",
        agentId: user.id,
        brokerageId: profile?.brokerageId ?? null,
        listedAt: status === "active" ? new Date() : null,
      })
      .returning({ id: listings.id });
    listingId = l.id;
    if (status === "active") await recordListed(p.id, listingId, d.price);
  }

  revalidatePath("/pro/listings");
  revalidatePath(`/pro/listings/${listingId}`);
  const note =
    intent === "publish" && status === "draft"
      ? "submitted"
      : status === "active"
        ? "published"
        : "saved";
  if (!existing) redirect(`/pro/listings/${listingId}?${note}=1`);
  return {
    ok: true,
    message:
      note === "submitted"
        ? "Saved and submitted — an admin will review it before it goes live."
        : note === "published"
          ? "Published. It's live on the marketplace."
          : "Changes saved.",
  };
}

function addressChanged(
  p: { street: string; city: string; state: string; postalCode: string },
  d: { street: string; city: string; state: string; postalCode: string },
) {
  return (
    p.street !== d.street ||
    p.city !== d.city ||
    p.state !== d.state ||
    p.postalCode !== d.postalCode
  );
}

async function recordListed(propertyId: string, listingId: string, price: number) {
  await getDb()
    .insert(priceHistory)
    .values({ propertyId, listingId, event: "listed", price, occurredAt: new Date() });
}

export async function setMyListingStatusAction(listingId: string, status: string) {
  const user = await requirePro();
  const s = z.enum(LISTING_STATUSES).parse(status);
  const mine = await getMyListing(user, uuid.parse(listingId));
  if (!mine) throw new Error("Listing not found.");
  const wasLive = (LIVE as readonly string[]).includes(mine.l.status);
  let next: (typeof LISTING_STATUSES)[number] = s;
  if (s === "active" || s === "coming_soon") {
    const allowed = await publishStatus(user, wasLive);
    if (allowed === "draft") next = "draft";
  }
  const closing = s === "sold" || s === "rented";
  await getDb()
    .update(listings)
    .set({
      status: next,
      listedAt: next === "active" ? (mine.l.listedAt ?? new Date()) : mine.l.listedAt,
      closedAt: closing ? new Date() : mine.l.closedAt,
      closePrice: closing ? (mine.l.closePrice ?? mine.l.price) : mine.l.closePrice,
      isFeatured: next === "active" || next === "coming_soon" ? mine.l.isFeatured : false,
    })
    .where(eq(listings.id, mine.l.id));
  const event = closing ? s : s === "pending" ? "pending" : s === "off_market" ? "delisted" : null;
  if (event)
    await getDb().insert(priceHistory).values({
      propertyId: mine.p.id,
      listingId: mine.l.id,
      event,
      price: mine.l.price,
      occurredAt: new Date(),
    });
  else if (next === "active" && !mine.l.listedAt)
    await recordListed(mine.p.id, mine.l.id, mine.l.price);
  revalidatePath("/pro/listings");
  revalidatePath(`/pro/listings/${mine.l.id}`);
}

export async function setMyListingFeaturedAction(
  listingId: string,
  featured: boolean,
): Promise<{ error?: string } | void> {
  const user = await requirePro();
  const mine = await getMyListing(user, uuid.parse(listingId));
  if (!mine) return { error: "Listing not found." };
  if (featured) {
    if (!(LIVE as readonly string[]).includes(mine.l.status))
      return { error: "Publish the listing before featuring it." };
    try {
      await assertCan(user.id, FEATURES.LISTINGS_FEATURED);
    } catch (err) {
      return { error: errorMessage(err, "Couldn't feature this listing.") };
    }
  }
  await getDb()
    .update(listings)
    .set({
      isFeatured: featured,
      featuredUntil: featured ? new Date(Date.now() + 30 * 86_400_000) : null,
    })
    .where(eq(listings.id, mine.l.id));
  revalidatePath(`/pro/listings/${mine.l.id}`);
  revalidatePath("/pro/listings");
}

/* ── Photos ──────────────────────────────────────────────────────────────── */

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function uploadListingPhotosAction(
  listingId: string,
  _prev: ProFormState,
  form: FormData,
): Promise<ProFormState> {
  const user = await requirePro();
  const mine = await getMyListing(user, uuid.parse(listingId));
  if (!mine) return { error: "Listing not found." };
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose one or more photos." };
  if (files.length > 20) return { error: "Upload at most 20 photos at a time." };
  const storage = getStorage();
  let order = mine.media.length;
  let added = 0;
  for (const file of files) {
    const ext = ALLOWED_UPLOAD_TYPES[file.type];
    if (!ext || ext === "pdf") return { error: `${file.name}: use JPEG, PNG, WebP or AVIF.` };
    if (file.size > MAX_PHOTO_BYTES) return { error: `${file.name} is larger than 8 MB.` };
    const key = `listings/${mine.p.id}/${randomUUID()}.${ext}`;
    const stored = await storage.put(key, new Uint8Array(await file.arrayBuffer()), file.type);
    await getDb()
      .insert(propertyMedia)
      .values({
        propertyId: mine.p.id,
        kind: "photo",
        url: stored.url,
        storageKey: stored.key,
        alt: `${mine.l.title} — photo ${order + 1}`,
        sortOrder: order++,
      });
    added++;
  }
  revalidatePath(`/pro/listings/${mine.l.id}`);
  return { ok: true, message: `Added ${added} photo${added === 1 ? "" : "s"}.` };
}

async function ownedMedia(user: SessionUser, mediaId: string) {
  const db = getDb();
  const [m] = await db
    .select({ media: propertyMedia, listingId: listings.id })
    .from(propertyMedia)
    .innerJoin(listings, eq(listings.propertyId, propertyMedia.propertyId))
    .where(eq(propertyMedia.id, uuid.parse(mediaId)))
    .limit(1);
  if (!m || !(await getMyListing(user, m.listingId))) throw new Error("Photo not found.");
  return m;
}

export async function deleteListingPhotoAction(mediaId: string) {
  const user = await requirePro();
  const { media, listingId } = await ownedMedia(user, mediaId);
  await getDb().delete(propertyMedia).where(eq(propertyMedia.id, media.id));
  if (media.storageKey)
    await getStorage()
      .delete(media.storageKey)
      .catch(() => {});
  revalidatePath(`/pro/listings/${listingId}`);
}

export async function moveListingPhotoAction(mediaId: string, direction: "up" | "down") {
  const user = await requirePro();
  const { media, listingId } = await ownedMedia(user, mediaId);
  const db = getDb();
  const [neighbor] = await db
    .select()
    .from(propertyMedia)
    .where(
      and(
        eq(propertyMedia.propertyId, media.propertyId),
        direction === "up"
          ? lt(propertyMedia.sortOrder, media.sortOrder)
          : gt(propertyMedia.sortOrder, media.sortOrder),
      ),
    )
    .orderBy(direction === "up" ? desc(propertyMedia.sortOrder) : asc(propertyMedia.sortOrder))
    .limit(1);
  if (!neighbor) return;
  await db
    .update(propertyMedia)
    .set({ sortOrder: neighbor.sortOrder })
    .where(eq(propertyMedia.id, media.id));
  await db
    .update(propertyMedia)
    .set({ sortOrder: media.sortOrder })
    .where(eq(propertyMedia.id, neighbor.id));
  revalidatePath(`/pro/listings/${listingId}`);
}

/* ── AI listing writer ───────────────────────────────────────────────────── */

export type DraftState =
  { ok: true; text: string; provider: string } | { ok: false; error: string } | undefined;

export async function generateListingDescriptionAction(form: FormData): Promise<DraftState> {
  const user = await requirePro();
  const n = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v === "" || isNaN(Number(v)) ? null : Number(v);
  };
  const facts: WriterFacts = {
    listingType: form.get("listingType") === "rent" ? "rent" : "sale",
    propertyType: z.enum(PROPERTY_TYPES).catch("single_family").parse(form.get("propertyType")),
    city: String(form.get("city") ?? "").trim(),
    state: String(form.get("state") ?? "")
      .trim()
      .toUpperCase(),
    neighborhood: String(form.get("neighborhood") ?? "").trim() || null,
    beds: n("beds"),
    baths: n("baths"),
    sqft: n("sqft"),
    lotSqft: n("lotSqft"),
    yearBuilt: n("yearBuilt"),
    garageSpaces: n("garageSpaces"),
    features: form.getAll("features").map(String),
    petsAllowed:
      form.get("petsAllowed") === "yes" ? true : form.get("petsAllowed") === "no" ? false : null,
    furnished: form.get("furnished") === "yes" ? true : null,
  };
  if (!facts.city || facts.state.length !== 2)
    return { ok: false, error: "Fill in the city and state first." };
  try {
    const res = await writeListingDescription(facts, user.id);
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "The writer is unavailable right now.") };
  }
}

/* ── Leads ───────────────────────────────────────────────────────────────── */

async function ownedLead(userId: string, leadId: string) {
  const [lead] = await getDb()
    .select()
    .from(leads)
    .where(and(eq(leads.id, uuid.parse(leadId)), eq(leads.ownerId, userId)))
    .limit(1);
  if (!lead) throw new Error("Lead not found.");
  return lead;
}

function followUpFrom(stage: LeadStage) {
  const days = followUpDaysFor(stage);
  return days === null ? null : new Date(Date.now() + days * 86_400_000);
}

export async function updateLeadStageAction(leadId: string, stage: string) {
  const user = await requirePro();
  const s = z.enum(LEAD_STAGES).parse(stage);
  const lead = await ownedLead(user.id, leadId);
  if (lead.stage === s) return;
  const db = getDb();
  await db
    .update(leads)
    .set({ stage: s, nextFollowUpAt: followUpFrom(s) })
    .where(eq(leads.id, lead.id));
  await db.insert(leadActivities).values({
    leadId: lead.id,
    actorId: user.id,
    type: "stage_change",
    body: `${lead.stage} → ${s}`,
  });
  revalidatePath("/pro/leads");
  revalidatePath(`/pro/leads/${lead.id}`);
}

const manualLeadSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(80),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().email().optional()),
  phone: optStr(30),
  intent: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["sale", "rent"]).optional()),
  budgetMax: optInt,
  message: optStr(2000),
  source: z.enum(["manual", "referral"]).default("manual"),
});

export async function createLeadAction(_prev: ProFormState, form: FormData): Promise<ProFormState> {
  const user = await requirePro();
  try {
    await assertCan(user.id, FEATURES.CRM);
  } catch (err) {
    return { error: errorMessage(err, "The CRM isn't available on your plan.") };
  }
  const parsed = manualLeadSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!parsed.data.email && !parsed.data.phone) return { error: "Add an email or phone number." };
  const [lead] = await getDb()
    .insert(leads)
    .values({
      ownerId: user.id,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      intent: parsed.data.intent ?? null,
      budgetMax: parsed.data.budgetMax ?? null,
      message: parsed.data.message ?? null,
      source: parsed.data.source,
      score: 30 + (parsed.data.phone ? 10 : 0) + (parsed.data.source === "referral" ? 25 : 0),
      nextFollowUpAt: followUpFrom("new"),
    })
    .returning({ id: leads.id });
  revalidatePath("/pro/leads");
  redirect(`/pro/leads/${lead.id}`);
}

const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  body: z.string().trim().min(1, "Write something.").max(4000),
  dueAt: optStr(30),
});

export async function addLeadActivityAction(
  leadId: string,
  _prev: ProFormState,
  form: FormData,
): Promise<ProFormState> {
  const user = await requirePro();
  const lead = await ownedLead(user.id, leadId);
  const parsed = activitySchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const due = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  if (due && isNaN(due.getTime())) return { error: "Pick a valid due date." };
  const db = getDb();
  await db.insert(leadActivities).values({
    leadId: lead.id,
    actorId: user.id,
    type: parsed.data.type,
    body: parsed.data.body,
    dueAt: parsed.data.type === "task" ? due : null,
  });
  const contact = ["call", "email", "sms", "meeting"].includes(parsed.data.type);
  await db
    .update(leads)
    .set({
      lastContactAt: contact ? new Date() : lead.lastContactAt,
      stage: contact && lead.stage === "new" ? "contacted" : lead.stage,
      nextFollowUpAt:
        parsed.data.type === "task" && due
          ? due
          : contact
            ? followUpFrom(lead.stage === "new" ? "contacted" : lead.stage)
            : lead.nextFollowUpAt,
    })
    .where(eq(leads.id, lead.id));
  revalidatePath(`/pro/leads/${lead.id}`);
  return { ok: true, message: parsed.data.type === "task" ? "Task added." : "Logged." };
}

export async function completeTaskAction(activityId: string) {
  const user = await requirePro();
  const db = getDb();
  const [a] = await db
    .select({ id: leadActivities.id, leadId: leadActivities.leadId })
    .from(leadActivities)
    .innerJoin(leads, eq(leads.id, leadActivities.leadId))
    .where(and(eq(leadActivities.id, uuid.parse(activityId)), eq(leads.ownerId, user.id)))
    .limit(1);
  if (!a) return;
  await db
    .update(leadActivities)
    .set({
      completedAt: sql`case when ${leadActivities.completedAt} is null then now() else null end`,
    })
    .where(eq(leadActivities.id, a.id));
  revalidatePath(`/pro/leads/${a.leadId}`);
}

export async function draftFollowUpAction(leadId: string): Promise<DraftState> {
  const user = await requirePro();
  const lead = await ownedLead(user.id, leadId);
  const [listing] = lead.listingId
    ? await getDb()
        .select({ title: listings.title })
        .from(listings)
        .where(eq(listings.id, lead.listingId))
    : [];
  try {
    const res = await draftLeadFollowUp(
      {
        name: lead.name,
        stage: lead.stage,
        intent: lead.intent,
        message: lead.message,
        listingTitle: listing?.title ?? null,
        lastContactAt: lead.lastContactAt,
      },
      user.name,
      user.id,
    );
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "The assistant is unavailable right now.") };
  }
}

export async function emailLeadAction(
  leadId: string,
  _prev: ProFormState,
  form: FormData,
): Promise<ProFormState> {
  const user = await requirePro();
  const lead = await ownedLead(user.id, leadId);
  if (!lead.email) return { error: "This lead has no email address." };
  const subject = z
    .string()
    .trim()
    .min(1, "Add a subject.")
    .max(150)
    .safeParse(form.get("subject"));
  const body = z.string().trim().min(5, "Write a message.").max(5000).safeParse(form.get("body"));
  if (!subject.success) return { error: subject.error.issues[0]?.message };
  if (!body.success) return { error: body.error.issues[0]?.message };
  const res = await sendEmail(lead.email, subject.data, body.data);
  if (res.status === "failed") return { error: "Delivery failed. Check the email provider." };
  const db = getDb();
  await db.insert(leadActivities).values({
    leadId: lead.id,
    actorId: user.id,
    type: "email",
    body: `${subject.data}\n\n${body.data}`,
  });
  const stage = lead.stage === "new" ? "contacted" : lead.stage;
  await db
    .update(leads)
    .set({ lastContactAt: new Date(), stage, nextFollowUpAt: followUpFrom(stage) })
    .where(eq(leads.id, lead.id));
  revalidatePath(`/pro/leads/${lead.id}`);
  return { ok: true, message: `Sent to ${lead.email}.` };
}

/* ── Tours ───────────────────────────────────────────────────────────────── */

export async function setTourStatusAction(tourId: string, status: string) {
  const user = await requirePro();
  const s = z.enum(["confirmed", "completed", "cancelled", "no_show"]).parse(status);
  const db = getDb();
  const [row] = await db
    .select({ t: tours, title: listings.title, slug: listings.slug })
    .from(tours)
    .innerJoin(listings, eq(listings.id, tours.listingId))
    .where(and(eq(tours.id, uuid.parse(tourId)), eq(tours.agentId, user.id)))
    .limit(1);
  if (!row) throw new Error("Tour not found.");
  await db.update(tours).set({ status: s }).where(eq(tours.id, row.t.id));

  if (s === "confirmed" || s === "cancelled") {
    const when = row.t.scheduledAt.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const title = s === "confirmed" ? `Tour confirmed for ${when}` : "Tour cancelled";
    const body =
      s === "confirmed"
        ? `${user.name} confirmed your ${row.t.type === "video" ? "video" : "in-person"} tour of ${row.title}.`
        : `${user.name} had to cancel your tour of ${row.title} (${when}). Reply to reschedule.`;
    if (row.t.requesterId)
      await notify(
        row.t.requesterId,
        { type: "tour", title, body, link: `/homes/${row.slug}` },
        { email: true },
      );
    else
      await sendEmail(row.t.contactEmail, title, body, {
        label: "View the home",
        href: `/homes/${row.slug}`,
      });
  }
  if (row.t.leadId) {
    await db.insert(leadActivities).values({
      leadId: row.t.leadId,
      actorId: user.id,
      type: "meeting",
      body: `Tour ${s.replace("_", " ")} (${row.title})`,
    });
    if (s === "completed")
      await db
        .update(leads)
        .set({ lastContactAt: new Date(), nextFollowUpAt: followUpFrom("touring") })
        .where(eq(leads.id, row.t.leadId));
  }
  revalidatePath("/pro/tours");
  revalidatePath("/pro");
}

/* ── Agent profile ───────────────────────────────────────────────────────── */

const csv = z.preprocess(
  (v) =>
    String(v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15),
  z.array(z.string().max(40)),
);

const profileSchema = z.object({
  headline: optStr(140),
  bio: optStr(3000),
  phone: optStr(30),
  licenseNumber: optStr(40),
  licenseState: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().length(2).toUpperCase().optional(),
  ),
  yearsExperience: optInt,
  specialties: csv,
  languages: csv,
  serviceAreas: csv,
});

export async function saveAgentProfileAction(
  _prev: ProFormState,
  form: FormData,
): Promise<ProFormState> {
  const user = await requirePro();
  const parsed = profileSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const values = {
    headline: d.headline ?? null,
    bio: d.bio ?? null,
    phone: d.phone ?? null,
    licenseNumber: d.licenseNumber ?? null,
    licenseState: d.licenseState ?? null,
    yearsExperience: d.yearsExperience ?? null,
    specialties: d.specialties,
    languages: d.languages,
    serviceAreas: d.serviceAreas,
    acceptingClients: form.get("acceptingClients") === "on",
  };
  await getDb()
    .insert(agentProfiles)
    .values({
      userId: user.id,
      slug: `${user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${user.id.slice(0, 6)}`,
      ...values,
    })
    .onConflictDoUpdate({ target: agentProfiles.userId, set: values });
  revalidatePath("/pro/profile");
  revalidatePath("/agents", "layout");
  return { ok: true, message: "Profile saved." };
}
