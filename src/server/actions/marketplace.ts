"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import {
  conversationParticipants,
  conversations,
  favorites,
  leadActivities,
  leads,
  listings,
  messages,
  reports,
  reviews,
  savedSearches,
  tours,
} from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { notify } from "@/server/notify";
import { trackEvent } from "@/server/listings";
import { refreshAgentRating } from "@/server/agents";
import { assertCanContact, assertCanReview, TrustError } from "@/server/trust/permissions";
import { AccountRestrictedError } from "@/server/trust/enforcement";
import { parseSearchParams } from "@/lib/search/query";

export type FormState = { ok?: boolean; error?: string; message?: string } | undefined;

/** Run a trust check; return its user-facing message instead of throwing. */
async function trustBlock(check: () => Promise<unknown>): Promise<string | null> {
  try {
    await check();
    return null;
  } catch (err) {
    if (err instanceof TrustError || err instanceof AccountRestrictedError) return err.message;
    throw err;
  }
}

/* ── Favorites ───────────────────────────────────────────────────────────── */

export async function toggleFavoriteAction(
  listingId: string,
): Promise<{ favorited: boolean } | { requiresAuth: true }> {
  const user = await getCurrentUser();
  if (!user) return { requiresAuth: true };
  const id = z.string().uuid().parse(listingId);
  const db = getDb();
  const deleted = await db
    .delete(favorites)
    .where(and(eq(favorites.userId, user.id), eq(favorites.listingId, id)))
    .returning({ id: favorites.listingId });
  const favorited = deleted.length === 0;
  if (favorited) {
    await db.insert(favorites).values({ userId: user.id, listingId: id }).onConflictDoNothing();
    trackEvent({ type: "favorite", userId: user.id, listingId: id });
  }
  await db
    .update(listings)
    .set({ saveCount: sql`greatest(0, ${listings.saveCount} + ${favorited ? 1 : -1})` })
    .where(eq(listings.id, id));
  revalidatePath("/favorites");
  return { favorited };
}

/* ── Contact agent (creates a CRM lead + conversation) ───────────────────── */

const contactSchema = z.object({
  listingId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(5, "Add a short message.").max(2000),
});

async function listingWithAgent(listingId: string) {
  const [row] = await getDb()
    .select({
      id: listings.id,
      title: listings.title,
      slug: listings.slug,
      agentId: listings.agentId,
      ownerId: listings.ownerId,
      listingType: listings.listingType,
      price: listings.price,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  return row ?? null;
}

export async function contactAgentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse({
    listingId: form.get("listingId"),
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone") || undefined,
    message: form.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const data = parsed.data;
  const listing = await listingWithAgent(data.listingId);
  const ownerId = listing?.agentId ?? listing?.ownerId;
  if (!listing || !ownerId) return { error: "This listing isn't accepting messages right now." };

  const user = await getCurrentUser();
  const blocked = user ? await trustBlock(() => assertCanContact(user.id, data.message)) : null;
  if (blocked) return { error: blocked };
  const db = getDb();
  const [lead] = await db
    .insert(leads)
    .values({
      ownerId,
      contactUserId: user?.id ?? null,
      listingId: listing.id,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      message: data.message,
      source: "listing_inquiry",
      intent: listing.listingType,
      score: 40 + (data.phone ? 15 : 0) + (user ? 10 : 0),
      nextFollowUpAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  await db
    .insert(leadActivities)
    .values({ leadId: lead.id, type: "note", body: `Inquiry: ${data.message}` });

  if (user && user.id !== ownerId) {
    const [conv] = await db
      .insert(conversations)
      .values({ subject: listing.title, listingId: listing.id })
      .returning();
    await db.insert(conversationParticipants).values([
      { conversationId: conv.id, userId: user.id, lastReadAt: new Date() },
      { conversationId: conv.id, userId: ownerId },
    ]);
    await db
      .insert(messages)
      .values({ conversationId: conv.id, senderId: user.id, body: data.message });
  }
  await notify(
    ownerId,
    {
      type: "lead",
      title: `New inquiry from ${data.name}`,
      body: `${listing.title}\n\n“${data.message}”`,
      link: "/pro/leads",
    },
    { email: true },
  );
  trackEvent({ type: "inquiry", userId: user?.id, listingId: listing.id });
  return { ok: true, message: "Message sent — the agent usually replies within a few hours." };
}

/* ── Tour requests ───────────────────────────────────────────────────────── */

const tourSchema = z.object({
  listingId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().max(30).optional(),
  type: z.enum(["in_person", "video"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time."),
  notes: z.string().trim().max(1000).optional(),
});

export async function requestTourAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = tourSchema.safeParse(
    Object.fromEntries([...form.entries()].map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const scheduledAt = new Date(`${d.date}T${d.time}:00`);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now())
    return { error: "Choose a time in the future." };

  const listing = await listingWithAgent(d.listingId);
  const agentId = listing?.agentId ?? listing?.ownerId;
  if (!listing || !agentId) return { error: "Tours aren't available for this listing." };
  const user = await getCurrentUser();
  const blocked = user ? await trustBlock(() => assertCanContact(user.id, d.notes ?? "")) : null;
  if (blocked) return { error: blocked };
  const db = getDb();
  const [lead] = await db
    .insert(leads)
    .values({
      ownerId: agentId,
      contactUserId: user?.id ?? null,
      listingId: listing.id,
      name: d.name,
      email: d.email,
      phone: d.phone ?? null,
      message: d.notes ?? `Tour request (${d.type === "video" ? "video" : "in person"})`,
      source: "tour_request",
      stage: "touring",
      intent: listing.listingType,
      score: 70,
    })
    .returning();
  await db.insert(tours).values({
    listingId: listing.id,
    requesterId: user?.id ?? null,
    agentId,
    leadId: lead.id,
    contactName: d.name,
    contactEmail: d.email,
    contactPhone: d.phone ?? null,
    type: d.type,
    scheduledAt,
    notes: d.notes ?? null,
  });
  const when = scheduledAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  await notify(
    agentId,
    {
      type: "tour",
      title: `Tour requested for ${when}`,
      body: `${d.name} wants a ${d.type === "video" ? "video" : "in-person"} tour of ${listing.title}.`,
      link: "/pro/tours",
    },
    { email: true },
  );
  if (user)
    await notify(user.id, {
      type: "tour",
      title: "Tour request sent",
      body: `${listing.title} · ${when}. We'll let you know when it's confirmed.`,
      link: `/homes/${listing.slug}`,
    });
  trackEvent({ type: "tour_request", userId: user?.id, listingId: listing.id });
  return { ok: true, message: `Requested for ${when}. The agent will confirm shortly.` };
}

/* ── Saved searches ──────────────────────────────────────────────────────── */

export async function saveSearchAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to save searches." };
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  const frequency = z
    .enum(["instant", "daily", "weekly", "off"])
    .safeParse(form.get("frequency") ?? "daily");
  if (!name.success || !frequency.success) return { error: "Give your search a name." };
  const query = parseSearchParams(new URLSearchParams(String(form.get("query") ?? "")));
  const { page: _p, pageSize: _ps, ...criteria } = query;
  void _p;
  void _ps;
  await getDb()
    .insert(savedSearches)
    .values({ userId: user.id, name: name.data, criteria, alertFrequency: frequency.data });
  revalidatePath("/saved-searches");
  return { ok: true, message: "Search saved. We'll email you when new homes match." };
}

export async function deleteSavedSearchAction(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await getDb()
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)));
  revalidatePath("/saved-searches");
}

export async function updateSavedSearchFrequencyAction(id: string, frequency: string) {
  const user = await getCurrentUser();
  const f = z.enum(["instant", "daily", "weekly", "off"]).safeParse(frequency);
  if (!user || !f.success) return;
  await getDb()
    .update(savedSearches)
    .set({ alertFrequency: f.data })
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)));
  revalidatePath("/saved-searches");
}

/* ── Agent reviews ───────────────────────────────────────────────────────── */

const reviewSchema = z.object({
  agentId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(80).optional(),
  body: z.string().trim().min(20, "Tell others a bit more (20+ characters).").max(2000),
  transactionType: z.enum(["Bought a home", "Sold a home", "Rented a home", "Other"]).optional(),
});

export async function submitReviewAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to leave a review." };
  const parsed = reviewSchema.safeParse(
    Object.fromEntries([...form.entries()].map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.agentId === user.id) return { error: "You can't review yourself." };
  const blocked = await trustBlock(() => assertCanReview(user.id));
  if (blocked) return { error: blocked };
  const general = await getSettings("general");
  const db = getDb();
  const status = general.requireReviewApproval ? "pending" : "published";
  await db
    .insert(reviews)
    .values({ ...parsed.data, authorId: user.id, authorName: user.name, status });
  if (status === "published") await refreshAgentRating(parsed.data.agentId);
  revalidatePath("/agents");
  return {
    ok: true,
    message:
      status === "pending"
        ? "Thanks! Your review will appear after a quick moderation check."
        : "Thanks for your review!",
  };
}

/* ── Contact an agent from their profile ─────────────────────────────────── */

const profileContactSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().max(30).optional(),
  intent: z.enum(["sale", "rent"]).optional(),
  message: z.string().trim().min(5, "Add a short message.").max(2000),
});

export async function contactAgentProfileAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = profileContactSchema.safeParse(
    Object.fromEntries([...form.entries()].map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const user = await getCurrentUser();
  const blocked = user ? await trustBlock(() => assertCanContact(user.id, d.message)) : null;
  if (blocked) return { error: blocked };
  const db = getDb();
  const [lead] = await db
    .insert(leads)
    .values({
      ownerId: d.agentId,
      contactUserId: user?.id ?? null,
      name: d.name,
      email: d.email,
      phone: d.phone ?? null,
      message: d.message,
      source: "agent_profile",
      intent: d.intent ?? null,
      score: 35 + (d.phone ? 15 : 0),
    })
    .returning();
  await db
    .insert(leadActivities)
    .values({ leadId: lead.id, type: "note", body: `Profile inquiry: ${d.message}` });
  await notify(
    d.agentId,
    {
      type: "lead",
      title: `New client inquiry from ${d.name}`,
      body: d.message,
      link: "/pro/leads",
    },
    { email: true },
  );
  return { ok: true, message: "Sent! Expect a reply soon." };
}

/* ── Trust & safety reports ──────────────────────────────────────────────── */

const reportSchema = z.object({
  targetType: z.enum(["listing", "review", "user", "message"]),
  targetId: z.string().min(1).max(100),
  reason: z.enum(["inaccurate", "fraud", "discrimination", "offensive", "spam", "other"]),
  details: z.string().trim().max(2000).optional(),
});

export async function submitReportAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = reportSchema.safeParse(
    Object.fromEntries([...form.entries()].map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) return { error: "Choose a reason." };
  const user = await getCurrentUser();
  await getDb()
    .insert(reports)
    .values({ ...parsed.data, reporterId: user?.id ?? null });
  return { ok: true, message: "Thanks — our team will review this report." };
}
