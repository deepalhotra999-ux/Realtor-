import Link from "next/link";
import { Eye, Heart, Inbox, Plus } from "lucide-react";
import { requirePro } from "@/server/auth/session";
import { listMyListings } from "@/server/pro/queries";
import { setMyListingStatusAction } from "@/server/actions/pro";
import { ActionSelect } from "@/components/admin/controls";
import { FilterTabs, PageHeader, Pill, StatusPill } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { formatPrice, relativeTime } from "@/lib/format";
import { LISTING_STATUSES } from "@/lib/domain";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Listings" };

const STATUS_OPTS = LISTING_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }));

export default async function ProListingsPage(props: PageProps<"/pro/listings">) {
  const sp = (await props.searchParams) as SP;
  const user = await requirePro();
  const status = str(sp, "status", "all");
  const { rows, counts } = await listMyListings(user, status);
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Listings"
        description="Create, edit and publish your listings."
        actions={
          <ButtonLink href="/pro/listings/new" size="sm">
            <Plus className="size-4" /> New listing
          </ButtonLink>
        }
      />
      <FilterTabs
        current={status}
        tabs={[
          { value: "all", label: "All", count: all },
          ...LISTING_STATUSES.filter((s) => counts[s]).map((s) => ({
            value: s,
            label: s.replace("_", " "),
            count: counts[s],
          })),
        ].map((t) => ({
          ...t,
          href: t.value === "all" ? "/pro/listings" : `/pro/listings?status=${t.value}`,
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No listings here yet"
          action={<ButtonLink href="/pro/listings/new">Create a listing</ButtonLink>}
        >
          Add the property facts and photos, then publish when you&apos;re ready.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => (
            <li
              key={l.id}
              className="border-line bg-surface shadow-card flex flex-wrap items-center gap-4 rounded-2xl border p-3"
            >
              <Link
                href={`/pro/listings/${l.id}`}
                className="bg-paper-2 relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-xl"
              >
                {l.photo ? (
                  <img src={l.photo} alt="" className="absolute inset-0 size-full object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/pro/listings/${l.id}`} className="hover:text-brand-600 font-semibold">
                  {l.title}
                </Link>
                <p className="text-muted truncate text-sm">
                  {l.street}, {l.city}, {l.state}
                </p>
                <div className="text-muted mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-ink font-medium">
                    {formatPrice(l.price, l.listingType)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="size-3.5" /> {l.viewCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="size-3.5" /> {l.saveCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Inbox className="size-3.5" /> {l.leadCount}
                  </span>
                  <span>Updated {relativeTime(l.updatedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {l.isFeatured ? <Pill tone="amber">featured</Pill> : null}
                <StatusPill status={l.status} />
                <ActionSelect
                  label={`Status for ${l.title}`}
                  value={l.status}
                  options={STATUS_OPTS}
                  action={setMyListingStatusAction.bind(null, l.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
