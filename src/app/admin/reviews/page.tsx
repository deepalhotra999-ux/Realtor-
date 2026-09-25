import Link from "next/link";
import { Star } from "lucide-react";
import { listReviewsAdmin, PAGE_SIZE } from "@/server/admin/queries";
import { moderateReviewAction } from "@/server/actions/admin";
import { ActionButton } from "@/components/admin/controls";
import { FilterTabs, PageHeader, Pagination, StatusPill } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { page as getPage, str, withParams, type SP } from "@/lib/params";

export const metadata = { title: "Reviews" };

export default async function ReviewsAdmin(props: PageProps<"/admin/reviews">) {
  const sp = (await props.searchParams) as SP;
  const status = str(sp, "status", "pending");
  const page = getPage(sp);
  const { rows, total, counts } = await listReviewsAdmin(status, page);
  return (
    <>
      <PageHeader
        title="Reviews"
        description="Publish genuine reviews; flag or remove ones that break the content policy."
      />
      <FilterTabs
        current={status}
        tabs={["pending", "published", "flagged", "removed", "all"].map((s) => ({
          value: s,
          label: s[0].toUpperCase() + s.slice(1),
          count: s === "all" ? undefined : (counts[s] ?? 0),
          href: withParams("/admin/reviews", sp, { status: s, page: undefined }),
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState title="Queue is clear">No reviews in this state.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ r, agent, agentSlug }) => (
            <li key={r.id} className="border-line bg-surface shadow-card rounded-2xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`size-4 ${i < r.rating ? "fill-gold-500 text-gold-500" : "text-line-strong"}`}
                        />
                      ))}
                    </span>
                    {r.title ? <span className="font-semibold">{r.title}</span> : null}
                    <StatusPill status={r.status} />
                  </div>
                  <p className="text-ink-2 mt-2 text-sm">{r.body}</p>
                  <p className="text-muted mt-2 text-xs">
                    {r.authorName} →{" "}
                    <Link href={`/agents/${agentSlug}`} className="underline">
                      {agent}
                    </Link>{" "}
                    · {r.transactionType} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status !== "published" ? (
                    <ActionButton
                      tone="primary"
                      action={moderateReviewAction.bind(null, r.id, "published")}
                    >
                      Publish
                    </ActionButton>
                  ) : null}
                  {r.status !== "flagged" ? (
                    <ActionButton action={moderateReviewAction.bind(null, r.id, "flagged")}>
                      Flag
                    </ActionButton>
                  ) : null}
                  {r.status !== "removed" ? (
                    <ActionButton
                      tone="danger"
                      action={moderateReviewAction.bind(null, r.id, "removed")}
                    >
                      Remove
                    </ActionButton>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        href={(p) => withParams("/admin/reviews", sp, { page: p })}
      />
    </>
  );
}
