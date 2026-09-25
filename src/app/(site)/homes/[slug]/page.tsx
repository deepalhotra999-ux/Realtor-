import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  BedDouble,
  Bath,
  CalendarClock,
  Car,
  ChevronRight,
  Clock,
  Home as HomeIcon,
  Info,
  Ruler,
  TrendingDown,
  Trees,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import {
  getFavoriteIds,
  getListingDetail,
  getSimilarListings,
  trackEvent,
} from "@/server/listings";
import { getMap } from "@/providers";
import {
  AMENITIES,
  LISTING_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type AmenityKey,
} from "@/lib/domain";
import {
  daysSince,
  formatAcres,
  formatAddress,
  formatBaths,
  formatDate,
  formatNumber,
  formatPrice,
} from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { Gallery } from "@/components/property/gallery";
import { MonthlyCost } from "@/components/property/monthly-cost";
import { PropertyAssistant } from "@/components/property/property-assistant";
import { ContactPanel } from "@/components/property/contact-panel";
import { FavoriteButton } from "@/components/listing/favorite-button";
import { CompareToggle } from "@/components/listing/compare-toggle";
import { ListingCard, listingBadges } from "@/components/listing/listing-card";
import { LocationMap } from "@/components/map";
import { ShareButton } from "@/components/property/share-button";
import { ReportButton } from "@/components/property/report-button";
import { SaveToBoard } from "@/components/boards/board-controls";
import { boardsForListing } from "@/server/boards";

export async function generateMetadata(props: PageProps<"/homes/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const l = await getListingDetail(slug);
  if (!l) return { title: "Home not found" };
  return {
    title: `${l.street}, ${l.city}, ${l.state} — ${formatPrice(l.price, l.listingType)}`,
    description: l.description.slice(0, 160),
    openGraph: { images: l.photoUrl ? [l.photoUrl] : undefined },
  };
}

const HISTORY_LABELS: Record<string, string> = {
  listed: "Listed",
  price_change: "Price change",
  pending: "Pending",
  sold: "Sold",
  rented: "Rented",
  delisted: "Removed",
  relisted: "Relisted",
};

export default async function ListingPage(props: PageProps<"/homes/[slug]">) {
  const { slug } = await props.params;
  const [listing, user] = await Promise.all([getListingDetail(slug), getCurrentUser()]);
  if (!listing) notFound();
  const l = listing;

  const [similar, favs, myBoards] = await Promise.all([
    getSimilarListings(l, 8),
    getFavoriteIds(user?.id),
    user ? boardsForListing(user.id, l.id) : [],
  ]);
  const anon = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? null;
  trackEvent({ type: "listing_view", userId: user?.id, listingId: l.id, anonymousId: anon });

  const address = formatAddress(l);
  const dom = daysSince(l.listedAt);
  const ppsf = l.sqft ? Math.round(l.price / l.sqft) : null;
  const badges = listingBadges(l);
  const f = l.facts as Record<string, string | undefined>;
  const factRows: [string, string | null | undefined][] = [
    ["Home type", PROPERTY_TYPE_LABELS[l.propertyType]],
    ["Year built", l.yearBuilt?.toString()],
    ["Stories", l.stories?.toString()],
    ["Lot", formatAcres(l.lotSqft)],
    ["Parking", l.garageSpaces ? `${l.garageSpaces}-car garage` : f.parking],
    ["Heating", f.heating],
    ["Cooling", f.cooling],
    ["Flooring", f.flooring],
    [
      "HOA",
      l.hoaMonthly ? `${formatPrice(l.hoaMonthly)}/mo` : l.listingType === "sale" ? "None" : null,
    ],
    ["Property tax", l.taxAnnual ? `${formatPrice(l.taxAnnual)}/yr` : null],
    ["County", l.county],
    ["School district", f.schoolDistrict],
  ];
  if (l.listingType === "rent") {
    factRows.unshift(
      ["Available", l.availableFrom ? formatDate(l.availableFrom) : "Now"],
      ["Lease", l.leaseTermMonths ? `${l.leaseTermMonths} months` : null],
      ["Deposit", l.deposit ? formatPrice(l.deposit) : null],
      ["Pets", l.petsAllowed === null ? null : l.petsAllowed ? "Allowed" : "Not allowed"],
      ["Furnished", l.furnished === null ? null : l.furnished ? "Yes" : "No"],
    );
  }
  const suggestions =
    l.listingType === "rent"
      ? ["Are pets allowed?", "What's the deposit?", "When is it available?", "Is there parking?"]
      : [
          "What are the HOA dues?",
          "Has the price dropped?",
          "What are the property taxes?",
          "Is there a garage?",
        ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: l.title,
    url: `/homes/${l.slug}`,
    datePosted: l.listedAt,
    offers: { "@type": "Offer", price: l.price, priceCurrency: l.currency },
    about: {
      "@type": "SingleFamilyResidence",
      address: {
        "@type": "PostalAddress",
        streetAddress: l.street,
        addressLocality: l.city,
        addressRegion: l.state,
        postalCode: l.postalCode,
      },
      numberOfRooms: l.beds,
      floorSize: l.sqft
        ? { "@type": "QuantitativeValue", value: l.sqft, unitCode: "FTK" }
        : undefined,
    },
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav className="text-muted mb-4 flex items-center gap-1 text-sm" aria-label="Breadcrumb">
        <Link
          href={l.listingType === "rent" ? "/search?type=rent" : "/search"}
          className="hover:text-ink"
        >
          {l.listingType === "rent" ? "Rent" : "Buy"}
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          href={`/search?place=${encodeURIComponent(`${l.city}, ${l.state}`)}${l.listingType === "rent" ? "&type=rent" : ""}`}
          className="hover:text-ink"
        >
          {l.city}, {l.state}
        </Link>
        {l.neighborhood ? (
          <>
            <ChevronRight className="size-3.5" />
            <Link
              href={`/search?place=${encodeURIComponent(`${l.neighborhood}, ${l.city}, ${l.state}`)}${l.listingType === "rent" ? "&type=rent" : ""}`}
              className="hover:text-ink"
            >
              {l.neighborhood}
            </Link>
          </>
        ) : null}
      </nav>

      <Gallery media={l.media} title={l.title} />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-10">
          {/* Header */}
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={l.status === "active" ? "brand" : "neutral"}>
                <span
                  className={`size-1.5 rounded-full ${l.status === "active" ? "bg-brand-500" : "bg-subtle"}`}
                />
                {l.listingType === "rent" && l.status === "active"
                  ? "For rent"
                  : LISTING_STATUS_LABELS[l.status]}
              </Badge>
              {badges
                .filter((b) => b.label !== "Coming soon")
                .map((b) => (
                  <Badge
                    key={b.label}
                    tone={b.tone === "white" ? "sky" : b.tone === "dark" ? "neutral" : b.tone}
                  >
                    {b.icon === "cut" ? <TrendingDown className="size-3" /> : null}
                    {b.label}
                  </Badge>
                ))}
              {l.source === "seed" ? <Badge tone="gold">Demo listing</Badge> : null}
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {formatPrice(l.price, l.listingType)}
                </p>
                <h1 className="text-ink-2 mt-2 text-lg">{address}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <FavoriteButton listingId={l.id} initial={favs.has(l.id)} variant="button" />
                <CompareToggle listingId={l.id} variant="button" />
                <SaveToBoard listingId={l.id} boards={myBoards} signedIn={Boolean(user)} />
                <ShareButton title={l.title} />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  icon: BedDouble,
                  label: "Beds",
                  value: l.beds === 0 ? "Studio" : (l.beds ?? "—"),
                },
                { icon: Bath, label: "Baths", value: formatBaths(l.baths) },
                { icon: Ruler, label: "Sqft", value: formatNumber(l.sqft) },
                l.propertyType === "land" || !l.sqft
                  ? { icon: Trees, label: "Lot", value: formatAcres(l.lotSqft) ?? "—" }
                  : {
                      icon: HomeIcon,
                      label: l.listingType === "rent" ? "$/sqft/mo" : "$/sqft",
                      value: ppsf
                        ? `$${l.listingType === "rent" ? (l.price / l.sqft).toFixed(2) : ppsf}`
                        : "—",
                    },
              ].map((s) => (
                <div key={s.label} className="border-line bg-surface rounded-2xl border p-4">
                  <s.icon className="text-brand-600 size-5" />
                  <p className="tabular mt-2 text-xl font-semibold">{s.value}</p>
                  <p className="text-muted text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          </header>

          <PropertyAssistant slug={l.slug} suggestions={suggestions} />

          {/* Overview */}
          <section>
            <h2 className="font-display text-2xl">About this home</h2>
            <div className="text-muted mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {dom !== null ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4" />{" "}
                  {dom === 0 ? "Listed today" : `${dom} days on Dwellwise`}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Info className="size-4" /> {formatNumber(l.viewCount)} views ·{" "}
                {formatNumber(l.saveCount)} saves
              </span>
              {l.garageSpaces ? (
                <span className="flex items-center gap-1.5">
                  <Car className="size-4" /> {l.garageSpaces}-car garage
                </span>
              ) : null}
            </div>
            <p className="text-ink-2 mt-4 leading-relaxed whitespace-pre-line">{l.description}</p>
            {l.openHouses.length ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {l.openHouses.map((o) => (
                  <div
                    key={o.startsAt}
                    className="border-brand-200 bg-brand-50 flex items-center gap-3 rounded-2xl border px-4 py-3"
                  >
                    <CalendarClock className="text-brand-600 size-5" />
                    <div>
                      <p className="text-brand-700 text-sm font-semibold">Open house</p>
                      <p className="text-ink-2 text-xs">
                        {formatDate(o.startsAt, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {/* Facts */}
          <section>
            <h2 className="font-display text-2xl">Facts & features</h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {factRows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="border-line flex justify-between gap-4 border-b py-3 text-sm"
                  >
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
            {l.features.length ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {l.features.map((k) => (
                  <span
                    key={k}
                    className="border-line bg-surface text-ink-2 rounded-full border px-3 py-1.5 text-sm"
                  >
                    {AMENITIES[k as AmenityKey] ?? k}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {l.listingType === "sale" ? (
            <section>
              <h2 className="font-display text-2xl">Monthly cost</h2>
              <div className="border-line bg-surface mt-5 rounded-3xl border p-6">
                <MonthlyCost price={l.price} taxAnnual={l.taxAnnual} hoaMonthly={l.hoaMonthly} />
              </div>
            </section>
          ) : null}

          {/* Location */}
          <section>
            <h2 className="font-display text-2xl">Location</h2>
            <p className="text-muted mt-1 text-sm">
              {l.neighborhood ? `${l.neighborhood}, ` : ""}
              {l.city}, {l.state} {l.postalCode}
            </p>
            <div className="border-line relative isolate mt-4 h-80 overflow-hidden rounded-3xl border">
              <LocationMap config={getMap().getConfig()} lat={l.latitude} lng={l.longitude} />
            </div>
          </section>

          {/* History */}
          <section>
            <h2 className="font-display text-2xl">Price history</h2>
            <div className="border-line bg-surface mt-4 overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-paper text-muted text-left text-xs">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Event</th>
                    <th className="px-4 py-2.5 text-right font-medium">Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[...l.priceHistory].reverse().map((h, i, arr) => {
                    const prev = arr[i + 1];
                    const delta = prev ? h.price - prev.price : null;
                    return (
                      <tr key={`${h.event}-${h.occurredAt}`} className="border-line border-t">
                        <td className="tabular px-4 py-3">{formatDate(h.occurredAt)}</td>
                        <td className="px-4 py-3">{HISTORY_LABELS[h.event] ?? h.event}</td>
                        <td className="tabular px-4 py-3 text-right font-medium">
                          {formatPrice(h.price, l.listingType)}
                        </td>
                        <td
                          className={`tabular px-4 py-3 text-right ${delta && delta < 0 ? "text-clay-600" : "text-muted"}`}
                        >
                          {delta
                            ? `${delta > 0 ? "+" : "−"}${formatPrice(Math.abs(delta))} (${((Math.abs(delta) / prev!.price) * 100).toFixed(1)}%)`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside id="contact" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <ContactPanel
            listingId={l.id}
            agent={l.agent}
            viewer={user ? { name: user.name, email: user.email, phone: user.phone } : null}
            listingType={l.listingType}
            address={`${l.street}${l.unit ? ` ${l.unit}` : ""}`}
          />
          <p className="text-muted mt-3 px-2 text-center text-xs">
            {l.source === "seed"
              ? "Fictional demo listing — contacting creates demo CRM activity."
              : "Listing information is deemed reliable but not guaranteed."}
          </p>
          <div className="mt-2 text-center">
            <ReportButton targetType="listing" targetId={l.id} />
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      <div className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur lg:hidden">
        <p className="tabular font-semibold">{formatPrice(l.price, l.listingType)}</p>
        <a
          href="#contact"
          className="bg-brand-600 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
        >
          Tour or message
        </a>
      </div>

      {similar.length ? (
        <section className="mt-16">
          <h2 className="font-display text-3xl">Similar homes nearby</h2>
          <div className="-mx-4 mt-6 flex snap-x scrollbar-none gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {similar.slice(0, 8).map((s) => (
              <div key={s.id} className="w-72 shrink-0 snap-start sm:w-auto">
                <ListingCard listing={s} favorited={favs.has(s.id)} compact />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
