import Link from "next/link";
import { Search } from "lucide-react";
import { listListingsAdmin, PAGE_SIZE } from "@/server/admin/queries";
import { setListingFeaturedAction, setListingStatusAction } from "@/server/actions/admin";
import { ActionSelect, Toggle } from "@/components/admin/controls";
import { FilterTabs, PageHeader, Pagination, Pill, Table, Td, Th } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { LISTING_STATUSES, LISTING_STATUS_LABELS } from "@/lib/domain";
import { formatDate, formatNumber, formatPrice } from "@/lib/format";
import { page as getPage, str, withParams, type SP } from "@/lib/params";

export const metadata = { title: "Listings" };

export default async function ListingsAdmin(props: PageProps<"/admin/listings">) {
  const sp = (await props.searchParams) as SP;
  const status = str(sp, "status", "all");
  const page = getPage(sp);
  const { rows, total, statusCounts } = await listListingsAdmin({
    q: str(sp, "q"),
    status,
    type: str(sp, "type", "all"),
    page,
  });
  const all = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const opts = LISTING_STATUSES.map((s) => ({ value: s, label: LISTING_STATUS_LABELS[s] }));

  return (
    <>
      <PageHeader
        title="Listings"
        description="Publish drafts, take listings down, and manage featured placement."
      />
      <FilterTabs
        current={status}
        tabs={[
          { value: "all", label: "All", count: all },
          ...LISTING_STATUSES.map((s) => ({
            value: s,
            label: LISTING_STATUS_LABELS[s],
            count: statusCounts[s] ?? 0,
          })),
        ].map((t) => ({
          ...t,
          href: withParams("/admin/listings", sp, {
            status: t.value === "all" ? undefined : t.value,
            page: undefined,
          }),
        }))}
      />
      <form className="mb-4 flex max-w-lg gap-2">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <div className="relative flex-1">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={str(sp, "q")}
            placeholder="Title, street or city"
            className="h-10 pl-9"
          />
        </div>
        <select
          name="type"
          defaultValue={str(sp, "type", "all")}
          className="border-line bg-surface h-10 rounded-xl border px-3 text-sm"
          aria-label="Type"
        >
          <option value="all">Sale & rent</option>
          <option value="sale">For sale</option>
          <option value="rent">For rent</option>
        </select>
      </form>
      <Table>
        <thead>
          <tr>
            <Th>Listing</Th>
            <Th>Price</Th>
            <Th>Agent</Th>
            <Th>Engagement</Th>
            <Th>Listed</Th>
            <Th>Status</Th>
            <Th>Featured</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <Td>
                <div className="flex items-center gap-3">
                  {l.photo ? (
                    <img src={l.photo} alt="" className="h-10 w-14 rounded-md object-cover" />
                  ) : (
                    <div className="bg-paper-2 h-10 w-14 rounded-md" />
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/homes/${l.slug}`}
                      className="block max-w-xs truncate font-medium hover:underline"
                    >
                      {l.street}
                    </Link>
                    <p className="text-muted text-xs">
                      {l.city}, {l.state} · {l.listingType === "rent" ? "Rent" : "Sale"}{" "}
                      {l.source === "seed" ? <Pill tone="amber">demo</Pill> : null}
                    </p>
                  </div>
                </div>
              </Td>
              <Td className="tabular">{formatPrice(l.price, l.listingType)}</Td>
              <Td>{l.agent ?? <span className="text-muted">Owner</span>}</Td>
              <Td className="text-muted tabular text-xs">
                {formatNumber(l.viewCount)} views · {l.saveCount} saves
              </Td>
              <Td className="text-muted">{l.listedAt ? formatDate(l.listedAt) : "—"}</Td>
              <Td>
                <ActionSelect
                  label="Status"
                  value={l.status}
                  options={opts}
                  action={setListingStatusAction.bind(null, l.id)}
                />
              </Td>
              <Td>
                <Toggle
                  checked={l.isFeatured}
                  label="Featured"
                  action={setListingFeaturedAction.bind(null, l.id)}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        href={(p) => withParams("/admin/listings", sp, { page: p })}
      />
    </>
  );
}
