import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  doublePrecision,
  geometry,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ────────────────────────────────────────────────────────────────────────────
 * Enums
 * ──────────────────────────────────────────────────────────────────────────── */

export const userRole = pgEnum("user_role", [
  "consumer",
  "agent",
  "broker",
  "property_manager",
  "admin",
]);
export const userStatus = pgEnum("user_status", ["active", "suspended", "pending"]);

export const propertyType = pgEnum("property_type", [
  "single_family",
  "condo",
  "townhouse",
  "multi_family",
  "apartment",
  "land",
  "manufactured",
]);

export const listingType = pgEnum("listing_type", ["sale", "rent"]);
export const listingStatus = pgEnum("listing_status", [
  "draft",
  "coming_soon",
  "active",
  "pending",
  "sold",
  "rented",
  "off_market",
]);
export const dataSource = pgEnum("data_source", ["seed", "manual", "mls", "import"]);
export const mediaKind = pgEnum("media_kind", ["photo", "floorplan", "video", "virtual_tour"]);
export const priceEvent = pgEnum("price_event", [
  "listed",
  "price_change",
  "pending",
  "sold",
  "rented",
  "delisted",
  "relisted",
]);

export const alertFrequency = pgEnum("alert_frequency", ["instant", "daily", "weekly", "off"]);

export const leadStage = pgEnum("lead_stage", [
  "new",
  "contacted",
  "qualified",
  "touring",
  "offer",
  "under_contract",
  "closed_won",
  "closed_lost",
]);
export const leadSource = pgEnum("lead_source", [
  "listing_inquiry",
  "tour_request",
  "agent_profile",
  "ai_assistant",
  "referral",
  "manual",
]);
export const activityType = pgEnum("activity_type", [
  "note",
  "call",
  "email",
  "sms",
  "meeting",
  "task",
  "stage_change",
]);

export const tourType = pgEnum("tour_type", ["in_person", "video"]);
export const tourStatus = pgEnum("tour_status", [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const moderationStatus = pgEnum("moderation_status", [
  "pending",
  "published",
  "flagged",
  "removed",
]);
export const reportStatus = pgEnum("report_status", ["open", "reviewing", "resolved", "dismissed"]);

export const featureKind = pgEnum("feature_kind", ["boolean", "limit", "metered"]);
export const planAudience = pgEnum("plan_audience", [
  "consumer",
  "agent",
  "broker",
  "property_manager",
]);
export const billingInterval = pgEnum("billing_interval", ["month", "year"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const outboundChannel = pgEnum("outbound_channel", ["email", "sms", "push"]);
export const outboundStatus = pgEnum("outbound_status", ["queued", "sent", "failed"]);

export const boardRole = pgEnum("board_role", ["owner", "editor", "viewer"]);

/* ────────────────────────────────────────────────────────────────────────────
 * Identity
 * ──────────────────────────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("consumer"),
    status: userStatus("status").notNull().default("active"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** Buyer/renter preferences used for personalized matching. */
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
    index("users_role_idx").on(t.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the session token; the raw token only lives in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const brokerages = pgTable(
  "brokerages",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    licenseNumber: text("license_number"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    city: text("city"),
    state: text("state"),
    logoUrl: text("logo_url"),
    description: text("description"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("brokerages_slug_uq").on(t.slug)],
);

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    brokerageId: uuid("brokerage_id").references(() => brokerages.id, { onDelete: "set null" }),
    headline: text("headline"),
    bio: text("bio"),
    licenseNumber: text("license_number"),
    licenseState: text("license_state"),
    yearsExperience: integer("years_experience"),
    specialties: text("specialties")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    languages: text("languages")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    serviceAreas: text("service_areas")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    phone: text("phone"),
    photoUrl: text("photo_url"),
    verified: boolean("verified").notNull().default(false),
    acceptingClients: boolean("accepting_clients").notNull().default(true),
    ratingAvg: real("rating_avg").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    closedDeals12mo: integer("closed_deals_12mo").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("agent_profiles_slug_uq").on(t.slug),
    index("agent_profiles_brokerage_idx").on(t.brokerageId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Properties & listings
 *
 * A property is the physical asset. A listing is a time-bound offer (sale or
 * rent) of a property. One property may accumulate many listings over time.
 * ──────────────────────────────────────────────────────────────────────────── */

export const properties = pgTable(
  "properties",
  {
    id: id(),
    source: dataSource("source").notNull().default("manual"),
    /** Identifier in the upstream provider (MLS number etc.). */
    externalId: text("external_id"),
    propertyType: propertyType("property_type").notNull(),
    street: text("street").notNull(),
    unit: text("unit"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code").notNull(),
    neighborhood: text("neighborhood"),
    county: text("county"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    location: geometry("location", { type: "point", mode: "xy", srid: 4326 }).notNull(),
    beds: integer("beds"),
    baths: real("baths"),
    sqft: integer("sqft"),
    lotSqft: integer("lot_sqft"),
    yearBuilt: integer("year_built"),
    stories: integer("stories"),
    garageSpaces: integer("garage_spaces"),
    /** Normalised amenity keys, e.g. "pool", "ev_charger", "fireplace". */
    features: text("features")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    hoaMonthly: integer("hoa_monthly"),
    taxAnnual: integer("tax_annual"),
    /** Arbitrary structured facts from the upstream provider. */
    facts: jsonb("facts").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index("properties_location_gist").using("gist", t.location),
    index("properties_city_idx").on(t.city, t.state),
    index("properties_postal_idx").on(t.postalCode),
    uniqueIndex("properties_source_external_uq").on(t.source, t.externalId),
  ],
);

export const listings = pgTable(
  "listings",
  {
    id: id(),
    slug: text("slug").notNull(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    listingType: listingType("listing_type").notNull(),
    status: listingStatus("status").notNull().default("draft"),
    /** Sale price or monthly rent, in whole currency units. */
    price: integer("price").notNull(),
    currency: text("currency").notNull().default("USD"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    agentId: uuid("agent_id").references(() => users.id, { onDelete: "set null" }),
    brokerageId: uuid("brokerage_id").references(() => brokerages.id, { onDelete: "set null" }),
    /** Owner for FSBO / property-manager listings. */
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    listedAt: timestamp("listed_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closePrice: integer("close_price"),
    // Rental specifics
    availableFrom: date("available_from"),
    leaseTermMonths: integer("lease_term_months"),
    deposit: integer("deposit"),
    petsAllowed: boolean("pets_allowed"),
    furnished: boolean("furnished"),
    // Engagement counters (denormalised for sorting)
    viewCount: integer("view_count").notNull().default(0),
    saveCount: integer("save_count").notNull().default(0),
    openHouses: jsonb("open_houses")
      .$type<{ startsAt: string; endsAt: string }[]>()
      .notNull()
      .default([]),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))`,
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("listings_slug_uq").on(t.slug),
    index("listings_property_idx").on(t.propertyId),
    index("listings_search_idx").on(t.status, t.listingType, t.price),
    index("listings_agent_idx").on(t.agentId),
    index("listings_fts_idx").using("gin", t.searchVector),
  ],
);

export const propertyMedia = pgTable(
  "property_media",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull().default("photo"),
    url: text("url").notNull(),
    storageKey: text("storage_key"),
    alt: text("alt").notNull().default(""),
    caption: text("caption"),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("property_media_property_idx").on(t.propertyId, t.sortOrder)],
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    event: priceEvent("event").notNull(),
    price: integer("price").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("price_history_property_idx").on(t.propertyId, t.occurredAt)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Consumer engagement
 * ──────────────────────────────────────────────────────────────────────────── */

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Serialised SearchQuery (see src/lib/search/query.ts). */
    criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull(),
    alertFrequency: alertFrequency("alert_frequency").notNull().default("daily"),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

/** Collaborative home search: shared boards for co-buyers, families, and their agent. */
export const boards = pgTable("boards", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").notNull().unique(),
  ...timestamps,
});

export const boardMembers = pgTable(
  "board_members",
  {
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: boardRole("role").notNull().default("editor"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.boardId, t.userId] })],
);

export const boardItems = pgTable(
  "board_items",
  {
    id: id(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    addedById: uuid("added_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("board_items_uq").on(t.boardId, t.listingId)],
);

export const boardVotes = pgTable(
  "board_votes",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => boardItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** -1 = pass, 1 = love it. */
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.userId] })],
);

export const boardComments = pgTable(
  "board_comments",
  {
    id: id(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => boardItems.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("board_comments_item_idx").on(t.itemId)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * CRM
 * ──────────────────────────────────────────────────────────────────────────── */

export const leads = pgTable(
  "leads",
  {
    id: id(),
    /** The agent / manager who owns this lead. */
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactUserId: uuid("contact_user_id").references(() => users.id, { onDelete: "set null" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    message: text("message"),
    source: leadSource("source").notNull().default("manual"),
    stage: leadStage("stage").notNull().default("new"),
    score: integer("score").notNull().default(0),
    intent: listingType("intent"),
    budgetMin: integer("budget_min"),
    budgetMax: integer("budget_max"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("leads_owner_stage_idx").on(t.ownerId, t.stage),
    index("leads_listing_idx").on(t.listingId),
  ],
);

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: id(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: activityType("type").notNull(),
    body: text("body"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_activities_lead_idx").on(t.leadId, t.createdAt)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Messaging & tours
 * ──────────────────────────────────────────────────────────────────────────── */

export const conversations = pgTable("conversations", {
  id: id(),
  subject: text("subject"),
  listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_participants_user_idx").on(t.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const tours = pgTable(
  "tours",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    requesterId: uuid("requester_id").references(() => users.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => users.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    type: tourType("type").notNull().default("in_person"),
    status: tourStatus("status").notNull().default("requested"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("tours_agent_time_idx").on(t.agentId, t.scheduledAt),
    index("tours_listing_idx").on(t.listingId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Trust & safety
 * ──────────────────────────────────────────────────────────────────────────── */

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    transactionType: text("transaction_type"),
    status: moderationStatus("status").notNull().default("pending"),
    response: text("response"),
    ...timestamps,
  },
  (t) => [index("reviews_agent_idx").on(t.agentId, t.status)],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    resolvedById: uuid("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolution: text("resolution"),
    ...timestamps,
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Platform configuration
 * ──────────────────────────────────────────────────────────────────────────── */

/** Key → JSON value store. Values are validated by zod schemas in src/server/settings. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  description: text("description").notNull().default(""),
  enabled: boolean("enabled").notNull().default(false),
  /** 0–100; users are bucketed deterministically by id. */
  rolloutPercent: integer("rollout_percent").notNull().default(100),
  /** Restrict to these roles (empty = everyone). */
  roles: text("roles")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  ...timestamps,
});

/* ────────────────────────────────────────────────────────────────────────────
 * Monetisation: Plans → Entitlements → Features
 * ──────────────────────────────────────────────────────────────────────────── */

/** A capability the platform can gate, e.g. "listings.active" or "ai.assistant". */
export const features = pgTable("features", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  kind: featureKind("kind").notNull().default("boolean"),
  /** Unit label for limits/meters, e.g. "listings", "requests". */
  unit: text("unit"),
  category: text("category").notNull().default("general"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const plans = pgTable(
  "plans",
  {
    id: id(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    audience: planAudience("audience").notNull().default("agent"),
    /** Prices in minor units (cents). */
    priceMonthly: integer("price_monthly").notNull().default(0),
    priceAnnual: integer("price_annual").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    trialDays: integer("trial_days").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(true),
    /** The plan everyone falls back to when they have no subscription. */
    isDefault: boolean("is_default").notNull().default(false),
    highlight: boolean("highlight").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("plans_key_uq").on(t.key)],
);

export const planEntitlements = pgTable(
  "plan_entitlements",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    featureKey: text("feature_key")
      .notNull()
      .references(() => features.key, { onDelete: "cascade", onUpdate: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    /** For limit/metered features. NULL = unlimited. */
    limitValue: integer("limit_value"),
  },
  (t) => [primaryKey({ columns: [t.planId, t.featureKey] })],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatus("status").notNull(),
    interval: billingInterval("interval").notNull().default("month"),
    /** Seats purchased for team plans. */
    seats: integer("seats").notNull().default(1),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    ...timestamps,
  },
  (t) => [index("subscriptions_user_idx").on(t.userId, t.status)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: paymentStatus("status").notNull(),
    description: text("description"),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_user_idx").on(t.userId, t.createdAt)],
);

/** Metered usage per subject, feature and period (e.g. AI requests per month). */
export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    featureKey: text("feature_key").notNull(),
    periodStart: date("period_start").notNull(),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.featureKey, t.periodStart] })],
);

/* ────────────────────────────────────────────────────────────────────────────
 * Notifications, outbox, observability
 * ──────────────────────────────────────────────────────────────────────────── */

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** Every outbound email/SMS is recorded here, whichever provider delivered it. */
export const outboundMessages = pgTable(
  "outbound_messages",
  {
    id: id(),
    channel: outboundChannel("channel").notNull(),
    provider: text("provider").notNull(),
    to: text("to").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    html: text("html"),
    status: outboundStatus("status").notNull().default("queued"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outbound_messages_created_idx").on(t.createdAt)],
);

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model"),
    latencyMs: integer("latency_ms").notNull(),
    success: boolean("success").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_requests_created_idx").on(t.createdAt)],
);

/** Product analytics events (page views, listing views, saves, inquiries). */
export const events = pgTable(
  "events",
  {
    id: id(),
    type: text("type").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    anonymousId: text("anonymous_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_type_created_idx").on(t.type, t.createdAt),
    index("events_listing_idx").on(t.listingId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);
