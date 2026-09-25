import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Search, Star } from "lucide-react";
import { getAgentFacets, listAgents, type AgentFilters } from "@/server/agents";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export const metadata: Metadata = { title: "Find an agent" };

export default async function AgentsPage(props: PageProps<"/agents">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const filters: AgentFilters = {
    q: str("q"),
    city: str("city"),
    specialty: str("specialty"),
    language: str("language"),
    sort: str("sort") as AgentFilters["sort"],
  };
  const [agents, facets] = await Promise.all([listAgents(filters), getAgentFacets()]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
      <p className="text-brand-600 text-xs font-semibold tracking-[0.14em] uppercase">
        Agents & brokers
      </p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Find a local expert</h1>
      <p className="text-muted mt-3 max-w-2xl">
        Compare agents by reviews, experience and the neighborhoods they know best.
      </p>

      <form className="border-line bg-surface shadow-card mt-8 grid grid-cols-1 gap-3 rounded-3xl border p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
        <div className="relative">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Agent or brokerage name"
            className="pl-10"
            aria-label="Name"
          />
        </div>
        <Select name="city" defaultValue={filters.city ?? ""} aria-label="City">
          <option value="">Any city</option>
          {facets.cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select name="specialty" defaultValue={filters.specialty ?? ""} aria-label="Specialty">
          <option value="">Any specialty</option>
          {facets.specialties.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select name="language" defaultValue={filters.language ?? ""} aria-label="Language">
          <option value="">Any language</option>
          {facets.languages.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select name="sort" defaultValue={filters.sort ?? "rating"} aria-label="Sort">
          <option value="rating">Top rated</option>
          <option value="reviews">Most reviews</option>
          <option value="deals">Most deals (12 mo)</option>
          <option value="experience">Most experience</option>
        </Select>
        <Button type="submit" className="h-11">
          Search
        </Button>
      </form>

      <p className="text-muted mt-6 text-sm">{agents.length} agents</p>
      {agents.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No agents match">Try a different city or specialty.</EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.slug}`}
              className="group border-line bg-surface shadow-card hover:shadow-lift rounded-3xl border p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                <Avatar name={a.name} src={a.photoUrl} size={60} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold group-hover:underline">
                    <span className="truncate">{a.name}</span>
                    {a.verified ? (
                      <BadgeCheck
                        className="text-brand-600 size-4 shrink-0"
                        aria-label="Verified"
                      />
                    ) : null}
                  </p>
                  <p className="text-muted truncate text-sm">{a.brokerageName ?? "Independent"}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    <Star className="fill-gold-500 text-gold-500 size-3.5" />
                    <span className="font-medium">
                      {a.reviewCount ? a.ratingAvg.toFixed(1) : "New"}
                    </span>
                    <span className="text-muted">({a.reviewCount})</span>
                  </p>
                </div>
              </div>
              <p className="text-ink-2 mt-4 line-clamp-2 text-sm">{a.headline}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Active", value: a.activeListings },
                  { label: "Deals 12mo", value: a.closedDeals12mo },
                  { label: "Years", value: a.yearsExperience ?? "—" },
                ].map((s) => (
                  <div key={s.label} className="bg-paper rounded-xl py-2">
                    <p className="tabular font-semibold">{s.value}</p>
                    <p className="text-muted text-[11px]">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {a.specialties.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
