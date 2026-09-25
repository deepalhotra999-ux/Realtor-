/**
 * Seeds a development database with FICTIONAL demo data:
 * settings, feature flags, features & plans, users, brokerages, agents,
 * listings (via the seed PropertyDataProvider), reviews, leads, tours,
 * conversations, favorites, saved searches, boards and analytics events.
 *
 *   pnpm db:seed            # wipes app tables, then seeds
 */
import { sql } from "drizzle-orm";
import { connect } from "./_db";
import * as s from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { SeedPropertyDataProvider } from "../src/providers/property-data/seed";
import { runImport } from "../src/server/import/pipeline";
import { FEATURE_CATALOG } from "../src/lib/entitlements/catalog";
import { DEFAULT_PLANS } from "../src/lib/entitlements/default-plans";
import { DEFAULT_FLAGS } from "../src/lib/flags";
import { METROS } from "../src/lib/geo/places";
import { createRng } from "../src/lib/random";
import { slugify } from "../src/lib/slug";
import {
  aiSettingsSchema,
  generalSettingsSchema,
  monetizationSettingsSchema,
} from "../src/lib/settings-schema";

const FIRST = [
  "Avery",
  "Jordan",
  "Maya",
  "Elena",
  "Marcus",
  "Priya",
  "Noah",
  "Sofia",
  "Daniel",
  "Aisha",
  "Leo",
  "Grace",
  "Mateo",
  "Hannah",
  "Omar",
  "Chloe",
  "Ethan",
  "Nina",
  "Samuel",
  "Zoe",
  "Isaac",
  "Lena",
  "Caleb",
  "Rosa",
  "Julian",
  "Imani",
  "Felix",
  "Tessa",
  "Andre",
  "Mei",
  "Victor",
  "Harper",
  "Diego",
  "Nora",
  "Kofi",
  "Ivy",
  "Rafael",
  "Lucia",
  "Theo",
  "Amara",
];
const LAST = [
  "Whitfield",
  "Okafor",
  "Castellano",
  "Brennan",
  "Nakamura",
  "Lindqvist",
  "Delgado",
  "Ashworth",
  "Moreau",
  "Patel",
  "Hollis",
  "Sato",
  "Everly",
  "Quinlan",
  "Abernathy",
  "Vasquez",
  "Reinholt",
  "Adeyemi",
  "Kowalski",
  "Marchetti",
  "Fairbanks",
  "Oyelaran",
  "Thorne",
  "Galloway",
  "Halvorsen",
  "Ibarra",
  "Nguyen",
  "Pemberton",
  "Sinclair",
  "Yilmaz",
];
const BROKERAGES = [
  "Northstar Realty Group",
  "Cedar & Stone Properties",
  "Harborline Homes",
  "Summit Key Realty",
  "Bluebird Real Estate Co.",
  "Meridian Residential",
  "Parkside Partners",
  "Lumen Living Realty",
];
const SPECIALTIES = [
  "First-time buyers",
  "Luxury homes",
  "Relocation",
  "Investment properties",
  "Condos",
  "New construction",
  "Downsizing",
  "Rentals & leasing",
  "Historic homes",
  "Veterans & VA loans",
  "Land & lots",
  "Multi-family",
];
const LANGUAGES = [
  "English",
  "Spanish",
  "Mandarin",
  "Vietnamese",
  "French",
  "Arabic",
  "Hindi",
  "Korean",
  "Portuguese",
  "Tagalog",
];
const REVIEW_BODIES = [
  "Responsive, patient and incredibly organised. We never felt rushed and every question got a clear answer.",
  "Knew the neighborhood inside and out and helped us avoid a house with foundation issues. Highly recommend.",
  "Negotiated a great price and kept the closing on schedule despite a tricky appraisal.",
  "Made renting from out of state painless — video tours, fast paperwork, and honest advice.",
  "Great communicator. Sold our home in under two weeks with multiple offers.",
  "Friendly and knowledgeable, though scheduling tours took a little longer than expected.",
  "Walked us through every step as first-time buyers. We felt genuinely looked after.",
  "Priced our condo well and staged it beautifully. Would work with them again.",
];

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing to seed a production database");
  const { db, sql: pg, close } = connect();
  const rng = createRng(2026);
  const now = new Date();
  const day = 86_400_000;
  const t0 = Date.now();

  console.log("› Clearing application tables …");
  const tables = await pg<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> 'spatial_ref_sys'`;
  if (tables.length) {
    await pg.unsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
  }

  console.log("› Settings, feature flags, features & plans …");
  await db.insert(s.appSettings).values([
    { key: "general", value: generalSettingsSchema.parse({}) },
    { key: "monetization", value: monetizationSettingsSchema.parse({}) },
    { key: "ai", value: aiSettingsSchema.parse({}) },
  ]);
  await db.insert(s.featureFlags).values(DEFAULT_FLAGS);
  await db
    .insert(s.features)
    .values(FEATURE_CATALOG.map((f, i) => ({ ...f, unit: f.unit ?? null, sortOrder: i })));
  for (const [i, p] of DEFAULT_PLANS.entries()) {
    const [plan] = await db
      .insert(s.plans)
      .values({
        key: p.key,
        name: p.name,
        description: p.description,
        audience: p.audience,
        priceMonthly: p.priceMonthly,
        priceAnnual: p.priceAnnual,
        trialDays: p.trialDays,
        isDefault: p.isDefault ?? false,
        highlight: p.highlight ?? false,
        sortOrder: i,
      })
      .returning();
    await db.insert(s.planEntitlements).values(
      Object.entries(p.entitlements).map(([featureKey, v]) => ({
        planId: plan.id,
        featureKey,
        enabled: v !== false,
        limitValue: typeof v === "number" ? v : null,
      })),
    );
  }

  console.log("› Users …");
  const demoHash = await hashPassword("demo12345");
  const adminHash = await hashPassword("admin12345");
  const [admin] = await db
    .insert(s.users)
    .values({
      email: "admin@dwellwise.local",
      name: "Alex Admin",
      role: "admin",
      passwordHash: adminHash,
      emailVerifiedAt: now,
    })
    .returning();
  const [buyer] = await db
    .insert(s.users)
    .values({
      email: "buyer@dwellwise.local",
      name: "Casey Buyer",
      role: "consumer",
      passwordHash: demoHash,
      emailVerifiedAt: now,
      preferences: {
        listingType: "sale",
        cities: ["Austin"],
        maxPrice: 750000,
        minBeds: 3,
        features: ["home_office", "fenced_yard"],
      },
    })
    .returning();
  const [partner] = await db
    .insert(s.users)
    .values({
      email: "partner@dwellwise.local",
      name: "Robin Buyer",
      role: "consumer",
      passwordHash: demoHash,
      emailVerifiedAt: now,
    })
    .returning();

  const consumers = [buyer, partner];
  for (let i = 0; i < 36; i++) {
    const name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    const [u] = await db
      .insert(s.users)
      .values({
        email: `${slugify(name)}.${i}@example.test`,
        name,
        role: "consumer",
        passwordHash: demoHash,
      })
      .returning();
    consumers.push(u);
  }

  console.log("› Brokerages & agents …");
  const brokerageRows = [];
  for (const [i, name] of BROKERAGES.entries()) {
    const metro = METROS[i % METROS.length];
    const [b] = await db
      .insert(s.brokerages)
      .values({
        slug: slugify(name),
        name,
        city: metro.city,
        state: metro.state,
        phone: `(555) 01${i}-${String(1000 + i * 37).slice(-4)}`,
        email: `hello@${slugify(name)}.example`,
        licenseNumber: `DEMO-BRK-${1000 + i}`,
        description: `${name} is a fictional brokerage used for demo purposes in ${metro.city}, ${metro.state}.`,
      })
      .returning();
    brokerageRows.push(b);
  }

  const agents: { id: string; brokerageId: string; metro: (typeof METROS)[number] }[] = [];
  for (let i = 0; i < 48; i++) {
    const metro = METROS[i % METROS.length];
    const name = i === 0 ? "Jamie Agent" : `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    const email = i === 0 ? "agent@dwellwise.local" : `${slugify(name)}.agent${i}@example.test`;
    const role = i % 12 === 1 ? "broker" : i % 16 === 5 ? "property_manager" : "agent";
    const [u] = await db
      .insert(s.users)
      .values({
        email,
        name,
        role,
        passwordHash: demoHash,
        emailVerifiedAt: now,
        phone: `(555) 02${String(i).padStart(2, "0")}-${String(4000 + i * 13).slice(-4)}`,
      })
      .returning();
    const brokerage =
      brokerageRows.filter((b) => b.city === metro.city)[0] ?? rng.pick(brokerageRows);
    await db.insert(s.agentProfiles).values({
      userId: u.id,
      slug: `${slugify(name)}-${i}`,
      brokerageId: brokerage.id,
      headline: rng.pick([
        `Helping ${metro.city} buyers find homes that fit`,
        `${metro.city} native · ${rng.pick(SPECIALTIES).toLowerCase()} specialist`,
        `Data-driven advice for ${metro.city} buyers and sellers`,
        `Your calm guide through the ${metro.city} market`,
      ]),
      bio: `${name.split(" ")[0]} is a fictional demo agent covering ${metro.neighborhoods
        .slice(0, 3)
        .map((n) => n.name)
        .join(
          ", ",
        )} and the wider ${metro.city} area. This profile exists to demonstrate agent pages.`,
      licenseNumber: `DEMO-${metro.state}-${100000 + i * 17}`,
      licenseState: metro.state,
      yearsExperience: rng.int(1, 24),
      specialties: rng.sample(SPECIALTIES, rng.int(2, 4)),
      languages: ["English", ...rng.sample(LANGUAGES.slice(1), rng.int(0, 2))],
      serviceAreas: rng.sample(
        metro.neighborhoods.map((n) => n.name),
        3,
      ),
      phone: u.phone,
      verified: rng.bool(0.7),
      closedDeals12mo: rng.int(2, 46),
    });
    agents.push({ id: u.id, brokerageId: brokerage.id, metro });
  }
  const demoAgent = agents[0];

  console.log("› Listings (fictional seed provider) …");
  const provider = new SeedPropertyDataProvider({ count: 640, seed: 42, now });
  await runImport(db, provider, {
    resolveAgent: (ref) => {
      const idx = Number(ref?.split("-")[1] ?? 0);
      // agentRef cycles 0..47 in step with the metro index, so agents list in their own metro.
      const a = agents[idx % agents.length];
      return { agentId: a.id, brokerageId: a.brokerageId };
    },
    onProgress: (n) => process.stdout.write(`\r  imported ${n}`),
  });
  process.stdout.write("\n");

  const allListings = await db
    .select({
      id: s.listings.id,
      agentId: s.listings.agentId,
      status: s.listings.status,
      listingType: s.listings.listingType,
      price: s.listings.price,
      slug: s.listings.slug,
      title: s.listings.title,
      city: s.properties.city,
    })
    .from(s.listings)
    .innerJoin(s.properties, sql`${s.listings.propertyId} = ${s.properties.id}`);
  const active = allListings.filter((l) => l.status === "active");

  console.log("› Reviews …");
  for (const a of agents) {
    const n = rng.int(1, 9);
    for (let i = 0; i < n; i++) {
      const author = rng.pick(consumers);
      await db.insert(s.reviews).values({
        agentId: a.id,
        authorId: author.id,
        authorName: author.name,
        rating: rng.weighted([
          [5, 10],
          [4, 5],
          [3, 1.2],
          [2, 0.3],
        ] as const),
        title: rng.pick([
          "Fantastic experience",
          "Would recommend",
          "Great local knowledge",
          "Smooth process",
          "Very helpful",
        ]),
        body: rng.pick(REVIEW_BODIES),
        transactionType: rng.pick(["Bought a home", "Sold a home", "Rented a home"]),
        status: rng.bool(0.9) ? "published" : "pending",
        createdAt: new Date(now.getTime() - rng.int(5, 700) * day),
      });
    }
  }
  await pg`
    update agent_profiles ap set
      rating_avg = coalesce(r.avg, 0), review_count = coalesce(r.n, 0)
    from (select agent_id, avg(rating)::real as avg, count(*)::int as n from reviews where status = 'published' group by agent_id) r
    where r.agent_id = ap.user_id`;

  console.log("› Leads, activities, tours, conversations …");
  const stages = [
    "new",
    "contacted",
    "qualified",
    "touring",
    "offer",
    "under_contract",
    "closed_won",
    "closed_lost",
  ] as const;
  for (const a of agents) {
    const mine = active.filter((l) => l.agentId === a.id);
    const n = a.id === demoAgent.id ? 18 : rng.int(2, 8);
    for (let i = 0; i < n && mine.length; i++) {
      const listing = rng.pick(mine);
      const contact = rng.pick(consumers);
      const stage = rng.weighted(stages.map((st, idx) => [st, idx < 3 ? 4 : 1.5] as const));
      const created = new Date(now.getTime() - rng.int(0, 60) * day);
      const [lead] = await db
        .insert(s.leads)
        .values({
          ownerId: a.id,
          contactUserId: contact.id,
          listingId: listing.id,
          name: contact.name,
          email: contact.email,
          phone: `(555) 03${String(i).padStart(2, "0")}-${String(rng.int(1000, 9999))}`,
          message: rng.pick([
            `Is ${listing.title.toLowerCase()} still available?`,
            "Could we see it this weekend?",
            "What are the HOA rules?",
            "Is the price negotiable?",
            "Are pets allowed?",
          ]),
          source: rng.pick([
            "listing_inquiry",
            "tour_request",
            "agent_profile",
            "ai_assistant",
          ] as const),
          stage,
          score: rng.int(15, 95),
          intent: listing.listingType,
          budgetMax: Math.round(listing.price * rng.float(1, 1.2)),
          lastContactAt: stage === "new" ? null : new Date(created.getTime() + rng.int(0, 5) * day),
          nextFollowUpAt: ["closed_won", "closed_lost"].includes(stage)
            ? null
            : new Date(now.getTime() + rng.int(-2, 7) * day),
          createdAt: created,
        })
        .returning();
      await db.insert(s.leadActivities).values({
        leadId: lead.id,
        actorId: a.id,
        type: "note",
        body: "Lead created from inquiry.",
        createdAt: created,
      });
      if (stage !== "new") {
        await db.insert(s.leadActivities).values({
          leadId: lead.id,
          actorId: a.id,
          type: rng.pick(["call", "email", "sms"] as const),
          body: "Introduced myself and shared similar listings.",
          createdAt: new Date(created.getTime() + day),
        });
      }
      if (["touring", "offer", "under_contract"].includes(stage) || rng.bool(0.2)) {
        await db.insert(s.tours).values({
          listingId: listing.id,
          requesterId: contact.id,
          agentId: a.id,
          leadId: lead.id,
          contactName: contact.name,
          contactEmail: contact.email,
          type: rng.bool(0.8) ? "in_person" : "video",
          status: rng.pick(["requested", "confirmed", "confirmed", "completed"] as const),
          scheduledAt: new Date(now.getTime() + rng.int(-5, 10) * day + rng.int(9, 17) * 3_600_000),
        });
      }
      if (i < 3) {
        const [conv] = await db
          .insert(s.conversations)
          .values({ subject: listing.title, listingId: listing.id, lastMessageAt: created })
          .returning();
        await db.insert(s.conversationParticipants).values([
          { conversationId: conv.id, userId: a.id, lastReadAt: created },
          { conversationId: conv.id, userId: contact.id, lastReadAt: created },
        ]);
        await db.insert(s.messages).values([
          {
            conversationId: conv.id,
            senderId: contact.id,
            body: lead.message ?? "Hi! I'm interested in this home.",
            createdAt: created,
          },
          {
            conversationId: conv.id,
            senderId: a.id,
            body: "Thanks for reaching out! It's available — happy to set up a tour. What times work for you?",
            createdAt: new Date(created.getTime() + 3_600_000),
          },
        ]);
      }
    }
  }

  console.log("› Favorites, saved searches, boards …");
  const austinSale = active.filter((l) => l.city === "Austin" && l.listingType === "sale");
  for (const l of rng.sample(austinSale, 6))
    await db.insert(s.favorites).values({ userId: buyer.id, listingId: l.id });
  for (const c of consumers.slice(2)) {
    for (const l of rng.sample(active, rng.int(0, 5)))
      await db.insert(s.favorites).values({ userId: c.id, listingId: l.id }).onConflictDoNothing();
  }
  await pg`update listings l set save_count = f.n from (select listing_id, count(*)::int n from favorites group by listing_id) f where f.listing_id = l.id`;

  await db.insert(s.savedSearches).values([
    {
      userId: buyer.id,
      name: "Austin family homes",
      criteria: { city: "Austin", state: "TX", listingType: "sale", minBeds: 3, maxPrice: 750000 },
      alertFrequency: "daily",
    },
    {
      userId: buyer.id,
      name: "Denver rentals with pets",
      criteria: { city: "Denver", state: "CO", listingType: "rent", petsAllowed: true },
      alertFrequency: "weekly",
    },
  ]);

  const [board] = await db
    .insert(s.boards)
    .values({
      name: "Our Austin shortlist",
      description: "Homes we're both excited about",
      ownerId: buyer.id,
      inviteCode: "demo-austin-board",
    })
    .returning();
  await db.insert(s.boardMembers).values([
    { boardId: board.id, userId: buyer.id, role: "owner" },
    { boardId: board.id, userId: partner.id, role: "editor" },
    { boardId: board.id, userId: demoAgent.id, role: "viewer" },
  ]);
  for (const l of austinSale.slice(0, 4)) {
    const [item] = await db
      .insert(s.boardItems)
      .values({ boardId: board.id, listingId: l.id, addedById: buyer.id })
      .returning();
    await db.insert(s.boardVotes).values([
      { itemId: item.id, userId: buyer.id, value: 1 },
      { itemId: item.id, userId: partner.id, value: rng.pick([1, -1]) },
    ]);
    await db.insert(s.boardComments).values({
      itemId: item.id,
      authorId: partner.id,
      body: rng.pick([
        "Love the kitchen!",
        "A bit far from work for me.",
        "Can we tour this Saturday?",
        "Great yard for the dog.",
      ]),
    });
  }

  console.log("› Notifications & analytics events …");
  await db.insert(s.notifications).values([
    {
      userId: buyer.id,
      type: "saved_search",
      title: "3 new homes match “Austin family homes”",
      link: "/search?city=Austin&state=TX&beds=3&maxPrice=750000",
    },
    {
      userId: buyer.id,
      type: "price_drop",
      title: "Price drop on a home you saved",
      link: `/homes/${austinSale[0]?.slug ?? ""}`,
    },
    { userId: demoAgent.id, type: "lead", title: "New lead: tour request", link: "/pro/leads" },
  ]);
  const eventRows = [];
  for (let i = 0; i < 4000; i++) {
    const l = rng.pick(active);
    const type = rng.weighted([
      ["listing_view", 20],
      ["search", 8],
      ["favorite", 2],
      ["inquiry", 1],
      ["tour_request", 0.6],
    ] as const);
    eventRows.push({
      type,
      listingId: type === "search" ? null : l.id,
      userId: rng.bool(0.4) ? rng.pick(consumers).id : null,
      anonymousId: `anon-${rng.int(1, 900)}`,
      meta: type === "search" ? { city: l.city } : {},
      createdAt: new Date(now.getTime() - rng.int(0, 89) * day - rng.int(0, 86_399) * 1000),
    });
  }
  for (let i = 0; i < eventRows.length; i += 500)
    await db.insert(s.events).values(eventRows.slice(i, i + 500));
  await pg`update listings l set view_count = e.n from (select listing_id, count(*)::int n from events where type = 'listing_view' group by listing_id) e where e.listing_id = l.id`;

  await db
    .insert(s.auditLogs)
    .values({ actorId: admin.id, action: "system.seed", meta: { listings: allListings.length } });

  console.log(
    `\n✓ Seeded ${allListings.length} fictional listings, ${agents.length} agents, ${consumers.length} consumers in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  console.log("\n  Demo accounts (password):");
  console.log("    admin@dwellwise.local   (admin12345)  — admin panel");
  console.log("    agent@dwellwise.local   (demo12345)   — agent workspace");
  console.log(
    "    buyer@dwellwise.local   (demo12345)   — buyer with favorites, boards & saved searches\n",
  );
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
