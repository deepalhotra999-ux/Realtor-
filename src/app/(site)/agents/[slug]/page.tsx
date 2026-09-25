import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Languages, MapPin, Star } from "lucide-react";
import { getAgentBySlug } from "@/server/agents";
import { getCurrentUser } from "@/server/auth/session";
import { getFavoriteIds } from "@/server/listings";
import { ListingCard } from "@/components/listing/listing-card";
import { AgentContactForm, ReviewForm } from "@/components/agents/agent-forms";
import { Avatar, Badge } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { formatCompactPrice, formatDate } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/agents/[slug]">): Promise<Metadata> {
  const data = await getAgentBySlug((await props.params).slug);
  return {
    title: data
      ? `${data.agent.name} — ${data.agent.brokerageName ?? "Real estate agent"}`
      : "Agent not found",
  };
}

export default async function AgentPage(props: PageProps<"/agents/[slug]">) {
  const { slug } = await props.params;
  const [data, user] = await Promise.all([getAgentBySlug(slug), getCurrentUser()]);
  if (!data) notFound();
  const { agent: a, listings, reviews, distribution, closed } = data;
  const favs = await getFavoriteIds(user?.id);
  const first = a.name.split(" ")[0];
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-12">
          <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar
              name={a.name}
              src={a.photoUrl}
              size={112}
              className="shadow-card ring-4 ring-white"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-4xl">{a.name}</h1>
                {a.verified ? (
                  <Badge tone="brand">
                    <BadgeCheck className="size-3.5" /> Verified license
                  </Badge>
                ) : null}
              </div>
              <p className="text-ink-2 mt-1">{a.headline}</p>
              <p className="text-muted mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>
                  {a.role === "broker"
                    ? "Broker"
                    : a.role === "property_manager"
                      ? "Property manager"
                      : "Agent"}{" "}
                  · {a.brokerageName ?? "Independent"}
                </span>
                {a.licenseNumber ? (
                  <span>
                    License {a.licenseNumber}
                    {a.licenseState ? ` (${a.licenseState})` : ""}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <Star className="fill-gold-500 text-gold-500 size-3.5" />{" "}
                  {a.reviewCount
                    ? `${a.ratingAvg.toFixed(1)} · ${a.reviewCount} reviews`
                    : "No reviews yet"}
                </span>
              </p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Active listings", value: a.activeListings },
              { label: "Deals (12 mo)", value: a.closedDeals12mo },
              { label: "Years experience", value: a.yearsExperience ?? "—" },
              {
                label: "Median closed price",
                value: closed.median ? formatCompactPrice(closed.median) : "—",
              },
            ].map((s) => (
              <div key={s.label} className="border-line bg-surface rounded-2xl border p-4">
                <p className="text-2xl font-semibold">{s.value}</p>
                <p className="text-muted text-xs">{s.label}</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="font-display text-2xl">About {first}</h2>
            <p className="text-ink-2 mt-3 leading-relaxed">{a.bio}</p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="text-brand-600 size-4" /> Service areas
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.serviceAreas.map((s) => (
                    <span key={s} className="bg-paper-2 rounded-full px-3 py-1 text-sm">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Languages className="text-brand-600 size-4" /> Languages
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.languages.map((s) => (
                    <span key={s} className="bg-paper-2 rounded-full px-3 py-1 text-sm">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.specialties.map((s) => (
                <Badge key={s} tone="brand">
                  {s}
                </Badge>
              ))}
            </div>
          </section>

          {listings.length ? (
            <section>
              <h2 className="font-display text-2xl">{first}&apos;s listings</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} compact />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="font-display text-2xl">Reviews</h2>
            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-[200px_1fr]">
              <div>
                <p className="text-5xl font-semibold">
                  {a.reviewCount ? a.ratingAvg.toFixed(1) : "—"}
                </p>
                <p className="text-muted text-sm">{a.reviewCount} verified reviews</p>
              </div>
              <ul className="space-y-1.5" aria-label="Rating distribution">
                {distribution.map((d) => (
                  <li key={d.stars} className="flex items-center gap-3 text-sm">
                    <span className="text-muted tabular w-10">{d.stars} ★</span>
                    <span className="bg-gold-100 h-2 flex-1 overflow-hidden rounded-full">
                      <span
                        className="bg-gold-500 block h-full rounded-full"
                        style={{ width: `${(d.count / maxCount) * 100}%` }}
                      />
                    </span>
                    <span className="text-muted tabular w-6 text-right">{d.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ul className="divide-line mt-8 divide-y">
              {reviews.map((r) => (
                <li key={r.id} className="py-5">
                  <div className="flex items-center gap-2">
                    <span className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`size-4 ${i < r.rating ? "fill-gold-500 text-gold-500" : "text-line-strong"}`}
                        />
                      ))}
                    </span>
                    {r.title ? <span className="font-semibold">{r.title}</span> : null}
                  </div>
                  <p className="text-ink-2 mt-2">{r.body}</p>
                  <p className="text-muted mt-2 text-xs">
                    {r.authorName} · {r.transactionType ?? "Client"} · {formatDate(r.createdAt)}
                  </p>
                  {r.response ? (
                    <p className="bg-paper text-ink-2 mt-3 rounded-xl p-3 text-sm">
                      <span className="font-semibold">Response from {first}:</span> {r.response}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="border-line bg-surface mt-6 rounded-3xl border p-6">
              <h3 className="font-semibold">Worked with {first}?</h3>
              <div className="mt-4">
                {user ? (
                  <ReviewForm agentId={a.id} />
                ) : (
                  <ButtonLink href={`/login?next=/agents/${a.slug}`} variant="secondary">
                    Sign in to leave a review
                  </ButtonLink>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border-line bg-surface shadow-card rounded-3xl border p-5">
            <h2 className="font-semibold">Contact {first}</h2>
            <p className="text-muted mb-4 text-sm">
              {a.acceptingClients
                ? "Currently accepting new clients."
                : "Not taking new clients right now."}
            </p>
            <AgentContactForm
              agentId={a.id}
              firstName={first}
              viewer={user ? { name: user.name, email: user.email } : null}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
