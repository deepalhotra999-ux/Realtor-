import type { Metadata } from "next";
import { Check, Sparkles, TriangleAlert } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getFavoriteIds } from "@/server/listings";
import { getRecommendations } from "@/server/recommendations";
import { clearHomePreferencesAction } from "@/server/actions/account";
import { ActionButton } from "@/components/admin/controls";
import { HomePrefsForm } from "@/components/account/home-prefs-form";
import { ListingCard } from "@/components/listing/listing-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/misc";
import { formatCompactPrice } from "@/lib/format";
import { AMENITIES, PROPERTY_TYPE_LABELS, type AmenityKey } from "@/lib/domain";
import type { Preferences } from "@/lib/ai/match";

export const metadata: Metadata = { title: "For you" };

function describe(p: Preferences): string[] {
  const out: string[] = [];
  if (p.listingType) out.push(p.listingType === "rent" ? "Renting" : "Buying");
  if (p.center?.label) out.push(`Near ${p.center.label}`);
  if (p.minPrice || p.maxPrice)
    out.push(
      `${p.minPrice ? formatCompactPrice(p.minPrice, p.listingType) : "Any"} – ${p.maxPrice ? formatCompactPrice(p.maxPrice, p.listingType) : "any"}`,
    );
  if (p.minBeds) out.push(`${p.minBeds}+ beds`);
  if (p.propertyTypes?.length)
    out.push(p.propertyTypes.map((t) => PROPERTY_TYPE_LABELS[t]).join(" / "));
  for (const f of p.features ?? []) out.push(AMENITIES[f as AmenityKey] ?? f);
  return out;
}

export default async function ForYouPage() {
  const user = await requireUser("/for-you");
  const [rec, favs] = await Promise.all([getRecommendations(user.id), getFavoriteIds(user.id)]);
  const chips = describe(rec.prefs);
  const hasExplicit = Object.keys(rec.explicit).length > 0;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_340px]">
      <div>
        <p className="text-brand-600 mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] uppercase">
          <Sparkles className="size-3.5" /> Personalized
        </p>
        <h1 className="font-display text-4xl">Homes for you</h1>
        <p className="text-muted mt-2 max-w-2xl">
          {rec.basedOn
            ? `Based on ${rec.basedOn} saved home${rec.basedOn === 1 ? "" : "s"}${hasExplicit ? " and the preferences you set" : ""}. Every score shows its reasons.`
            : hasExplicit
              ? "Based on the preferences you set. Save homes to sharpen your matches."
              : "Save a few homes or tell us what you want, and we'll rank new listings for you."}
        </p>
        {chips.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="bg-paper-2 text-ink-2 rounded-full px-2.5 py-1 text-xs">
                {c}
              </span>
            ))}
          </div>
        ) : null}

        {rec.results.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title={chips.length ? "No matches right now" : "Tell us what you're after"}
              action={<ButtonLink href="/search">Browse homes</ButtonLink>}
            >
              {chips.length
                ? "Nothing active fits yet. Try widening your budget or area."
                : "Use the form, or save homes with the heart button while you browse."}
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {rec.results.map(({ listing, match }) => (
              <li key={listing.id} className="flex flex-col">
                <ListingCard listing={listing} favorited={favs.has(listing.id)} />
                <div className="mt-3 px-1">
                  <p className="text-sm font-semibold">
                    <span className="text-brand-600">{match.score}</span>
                    <span className="text-muted font-normal">/100 match</span>
                  </p>
                  <ul className="mt-1.5 space-y-1 text-xs">
                    {match.reasons.map((r) => (
                      <li key={r} className="text-ink-2 flex gap-1.5">
                        <Check className="text-brand-600 size-3.5 shrink-0" /> {r}
                      </li>
                    ))}
                    {match.tradeoffs.map((t) => (
                      <li key={t} className="text-muted flex gap-1.5">
                        <TriangleAlert className="text-gold-500 size-3.5 shrink-0" /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside>
        <Card className="p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">Your preferences</h2>
          <p className="text-muted mt-1 mb-4 text-xs">
            Anything you set here overrides what we infer from your saved homes.
          </p>
          <HomePrefsForm p={rec.explicit} />
          {hasExplicit ? (
            <div className="border-line mt-4 border-t pt-4">
              <ActionButton action={clearHomePreferencesAction}>Clear my preferences</ActionButton>
            </div>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}
