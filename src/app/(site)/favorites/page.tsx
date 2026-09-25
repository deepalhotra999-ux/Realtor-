import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getFavoriteListings } from "@/server/listings";
import { ListingCard } from "@/components/listing/listing-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Saved homes" };

export default async function FavoritesPage() {
  const user = await requireUser("/favorites");
  const items = await getFavoriteListings(user.id);
  const active = items.filter((l) => l.status === "active" || l.status === "coming_soon");
  const off = items.filter((l) => !active.includes(l));
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Saved homes</h1>
          <p className="text-muted mt-2">
            {items.length} saved · we&apos;ll notify you about price changes.
          </p>
        </div>
        {items.length >= 2 ? (
          <ButtonLink
            href={`/compare?ids=${items
              .slice(0, 4)
              .map((l) => l.id)
              .join(",")}`}
            variant="secondary"
          >
            Compare top {Math.min(4, items.length)}
          </ButtonLink>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Heart className="size-5" />}
            title="No saved homes yet"
            action={<ButtonLink href="/search">Start searching</ButtonLink>}
          >
            Tap the heart on any home to keep it here.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {active.map((l) => (
              <ListingCard key={l.id} listing={l} favorited />
            ))}
          </div>
          {off.length ? (
            <>
              <h2 className="mt-14 text-lg font-semibold">No longer available</h2>
              <div className="mt-4 grid grid-cols-1 gap-5 opacity-70 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {off.map((l) => (
                  <ListingCard key={l.id} listing={l} favorited compact />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
