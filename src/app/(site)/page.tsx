import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  Calculator,
  GitCompareArrows,
  MessageCircleQuestion,
  Sparkles,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getCityStats, getFavoriteIds, getFeaturedListings } from "@/server/listings";
import { HeroSearch } from "@/components/search/hero-search";
import { ListingCard } from "@/components/listing/listing-card";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/misc";
import { formatCompactPrice } from "@/lib/format";
import { METROS } from "@/lib/geo/places";

const PROMPTS = [
  "3 bed house under $650k in Austin with a home office",
  "Pet-friendly 2br apartment in Capitol Hill under $2,800",
  "Townhome near South End with a garage",
  "New construction in Raleigh with solar",
];

function cityHref(city: string, state: string) {
  const metro = METROS.find((m) => m.city === city && m.state === state);
  const params = new URLSearchParams({ place: `${city}, ${state}` });
  if (metro) {
    const d = 0.14;
    params.set(
      "bbox",
      [metro.lng - d * 1.2, metro.lat - d, metro.lng + d * 1.2, metro.lat + d]
        .map((n) => n.toFixed(4))
        .join(","),
    );
  }
  return `/search?${params}`;
}

const CITY_TINTS = [
  "from-brand-700 to-brand-500",
  "from-[#3e5c7a] to-[#6f8fb0]",
  "from-[#8a5a3b] to-[#c48a5c]",
  "from-[#4b5d4e] to-[#7d9a82]",
  "from-[#6b4f6e] to-[#9b7c9e]",
  "from-[#2f4b45] to-[#5b8077]",
  "from-[#7a5b1d] to-[#c3962b]",
  "from-[#46505c] to-[#7c8794]",
];

export default async function HomePage() {
  await connection();
  const user = await getCurrentUser();
  const [featured, fresh, cities, favs] = await Promise.all([
    getFeaturedListings(4),
    getFeaturedListings(8, "newest"),
    getCityStats(),
    getFavoriteIds(user?.id),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="border-line relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-100),transparent_55%),radial-gradient(ellipse_at_bottom_left,var(--color-gold-100),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20 lg:pb-24">
          <div>
            <p className="border-brand-200 text-brand-700 mb-5 inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="size-3.5" /> Search in plain English — powered by open-source AI
            </p>
            <h1 className="font-display text-ink text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
              Find the place
              <br />
              that <em className="text-brand-600">fits</em> your life.
            </h1>
            <p className="text-ink-2 mt-6 max-w-xl text-lg">
              Map-first search, honest AI matching, and shared boards to decide together. Free for
              buyers, renters and agents.
            </p>
            <div className="mt-8">
              <HeroSearch />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {PROMPTS.map((p) => (
                <Link
                  key={p}
                  href={`/search?q=${encodeURIComponent(p)}`}
                  className="border-line text-ink-2 hover:border-brand-300 hover:text-brand-700 rounded-full border bg-white/70 px-3 py-1.5 text-xs backdrop-blur transition"
                >
                  “{p}”
                </Link>
              ))}
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              {featured.slice(0, 4).map((l, i) => (
                <Link
                  key={l.id}
                  href={`/homes/${l.slug}`}
                  className={`group bg-surface shadow-lift overflow-hidden rounded-3xl border border-white/60 transition hover:-translate-y-1 ${i % 2 ? "translate-y-10" : ""}`}
                >
                  <div className="bg-paper-2 aspect-[4/3] overflow-hidden">
                    {l.photoUrl ? (
                      <img
                        src={l.photoUrl}
                        alt=""
                        className="size-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-3.5">
                    <p className="tabular font-semibold">
                      {formatCompactPrice(l.price, l.listingType)}
                      {l.listingType === "rent" ? "/mo" : ""}
                    </p>
                    <p className="text-muted truncate text-xs">
                      {l.neighborhood}, {l.city}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-[1440px] px-4 pt-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading eyebrow="Fresh on Dwellwise" title="Homes worth a look" />
          <ButtonLink
            href="/search?sort=newest"
            variant="secondary"
            className="hidden sm:inline-flex"
          >
            Browse all <ArrowRight className="size-4" />
          </ButtonLink>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {fresh.map((l, i) => (
            <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* Cities */}
      <section className="mx-auto max-w-[1440px] px-4 pt-20 sm:px-6">
        <SectionHeading eyebrow="Explore" title="Popular markets">
          Median asking prices from active demo listings.
        </SectionHeading>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cities.map((c, i) => (
            <Link
              key={`${c.city}-${c.state}`}
              href={cityHref(c.city, c.state)}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${CITY_TINTS[i % CITY_TINTS.length]} shadow-card hover:shadow-lift p-6 text-white transition hover:-translate-y-0.5`}
            >
              <div className="absolute -right-8 -bottom-10 size-40 rounded-full bg-white/10 transition group-hover:scale-110" />
              <p className="text-sm text-white/75">{c.state}</p>
              <h3 className="font-display mt-1 text-3xl">{c.city}</h3>
              <div className="mt-8 flex gap-6 text-sm">
                <div>
                  <p className="text-white/70">For sale</p>
                  <p className="tabular font-semibold">
                    {c.forSale} · {c.medianSale ? formatCompactPrice(c.medianSale) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-white/70">For rent</p>
                  <p className="tabular font-semibold">
                    {c.forRent} · {c.medianRent ? `$${c.medianRent.toLocaleString("en-US")}` : "—"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1440px] px-4 pt-24 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="bg-ink relative overflow-hidden rounded-3xl p-8 text-white lg:col-span-2">
            <div className="bg-brand-500/30 absolute -top-20 -right-10 size-72 rounded-full blur-3xl" />
            <p className="relative inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" /> AI Home Finder
            </p>
            <h2 className="font-display relative mt-5 max-w-lg text-4xl leading-tight">
              Tell us how you live. We&apos;ll show you where.
            </h2>
            <p className="relative mt-4 max-w-xl text-white/70">
              Describe your must-haves in your own words. Every match comes with the reasons behind
              it — pulled straight from listing facts, never made up.
            </p>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/ai" className="text-ink hover:bg-brand-50 bg-white">
                Start a conversation <ArrowRight className="size-4" />
              </ButtonLink>
              <span className="self-center text-xs text-white/50">
                Runs on local open-source models
              </span>
            </div>
          </div>
          <div className="border-line bg-surface shadow-card rounded-3xl border p-8">
            <span className="bg-clay-50 text-clay-600 flex size-11 items-center justify-center rounded-2xl">
              <Users className="size-5" />
            </span>
            <h3 className="font-display mt-5 text-2xl">Decide together</h3>
            <p className="text-muted mt-2 text-sm">
              Shared boards let partners, family and your agent vote and comment on homes in one
              place.
            </p>
            <Link
              href={user ? "/boards" : "/register"}
              className="text-brand-600 mt-6 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              Create a board <ArrowRight className="size-4" />
            </Link>
          </div>
          {[
            {
              icon: GitCompareArrows,
              title: "Compare side by side",
              body: "Line up to four homes and see price per sqft, fees and features at a glance.",
              href: "/compare",
              cta: "Open compare",
            },
            {
              icon: Calculator,
              title: "Know your monthly cost",
              body: "Principal, interest, taxes, insurance, HOA and PMI — plus what you can afford.",
              href: "/mortgage",
              cta: "Mortgage calculator",
            },
            {
              icon: MessageCircleQuestion,
              title: "Ask about any home",
              body: "Get instant answers from listing data, or a clear “not listed” when we don't know.",
              href: "/search",
              cta: "Find a home",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="border-line bg-surface shadow-card rounded-3xl border p-8"
            >
              <span className="bg-brand-50 text-brand-600 flex size-11 items-center justify-center rounded-2xl">
                <f.icon className="size-5" />
              </span>
              <h3 className="font-display mt-5 text-2xl">{f.title}</h3>
              <p className="text-muted mt-2 text-sm">{f.body}</p>
              <Link
                href={f.href}
                className="text-brand-600 mt-6 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                {f.cta} <ArrowRight className="size-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Pro CTA */}
      <section className="mx-auto max-w-[1440px] px-4 pt-24 sm:px-6">
        <div className="border-brand-200 bg-brand-50 grid grid-cols-1 items-center gap-8 rounded-3xl border p-8 sm:p-12 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="text-brand-600 text-xs font-semibold tracking-[0.14em] uppercase">
              For agents, brokers & property managers
            </p>
            <h2 className="font-display text-ink mt-3 text-4xl">
              List, nurture leads and book tours — free.
            </h2>
            <p className="text-ink-2 mt-3 max-w-2xl">
              A built-in CRM, messaging, tour scheduling and an AI listing writer. No per-lead fees
              while we grow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <ButtonLink href="/register?role=agent" size="lg">
              Join as a pro
            </ButtonLink>
            <ButtonLink href="/sell" variant="secondary" size="lg">
              Selling a home?
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
