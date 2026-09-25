import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, BellRing, Search } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { savedSearches } from "@/server/db/schema";
import { getSearch } from "@/providers";
import { DEFAULT_QUERY, searchQuerySchema, toSearchParams } from "@/lib/search/query";
import { describeQuery } from "@/lib/search/describe";
import { relativeTime } from "@/lib/format";
import { SavedSearchControls } from "@/components/search/saved-search-controls";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Saved searches" };

export default async function SavedSearchesPage() {
  const user = await requireUser("/saved-searches");
  const rows = await getDb()
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, user.id))
    .orderBy(desc(savedSearches.createdAt));
  const enriched = await Promise.all(
    rows.map(async (r) => {
      const parsed = searchQuerySchema.safeParse(r.criteria);
      const q = parsed.success ? parsed.data : DEFAULT_QUERY;
      const res = await getSearch().search({ ...q, page: 1, pageSize: 1 });
      return { ...r, q, total: res.total };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl">Saved searches</h1>
      <p className="text-muted mt-2">
        We check these for new matches and email you on your schedule.
      </p>
      {enriched.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<BellRing className="size-5" />}
            title="No saved searches"
            action={<ButtonLink href="/search">Start a search</ButtonLink>}
          >
            Use “Save search” on the results page to get alerts for new homes.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {enriched.map((s) => (
            <li key={s.id} className="border-line bg-surface shadow-card rounded-2xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <Search className="text-brand-600 size-4" /> {s.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {describeQuery(s.q).map((c) => (
                      <span
                        key={c}
                        className="bg-paper text-ink-2 rounded-full px-2.5 py-0.5 text-xs"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="text-muted mt-2 text-xs">
                    Saved {relativeTime(s.createdAt)}
                    {s.lastNotifiedAt ? ` · last alert ${relativeTime(s.lastNotifiedAt)}` : ""}
                  </p>
                </div>
                <SavedSearchControls id={s.id} frequency={s.alertFrequency} />
              </div>
              <Link
                href={`/search?${toSearchParams(s.q)}`}
                className="text-brand-600 mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                View {s.total} matching home{s.total === 1 ? "" : "s"}{" "}
                <ArrowRight className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
