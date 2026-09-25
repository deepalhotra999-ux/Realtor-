import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { z } from "zod";
import { requireWorkspace } from "@/server/auth/session";
import { getMyListing } from "@/server/pro/queries";
import { setMyListingFeaturedAction } from "@/server/actions/pro";
import { Toggle } from "@/components/admin/controls";
import { PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { ListingForm } from "@/components/pro/listing-form";
import { PhotoManager } from "@/components/pro/photo-manager";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage(props: PageProps<"/pro/listings/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams as Promise<SP>]);
  const user = await requireWorkspace();
  if (!z.string().uuid().safeParse(id).success) notFound();
  const row = await getMyListing(user, id);
  if (!row) notFound();
  const { l, p, media } = row;
  const live = ["active", "coming_soon", "pending"].includes(l.status);
  const banner = str(sp, "published")
    ? "Published — your listing is live."
    : str(sp, "submitted")
      ? "Submitted for review. It goes live once an admin approves it."
      : str(sp, "saved")
        ? "Draft saved. Add photos, then publish."
        : null;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={l.title}
        description={
          <span className="flex items-center gap-2">
            <StatusPill status={l.status} />
            {live ? (
              <Link
                href={`/homes/${l.slug}`}
                className="text-brand-600 inline-flex items-center gap-1 text-sm"
                target="_blank"
              >
                View live listing <ExternalLink className="size-3.5" />
              </Link>
            ) : null}
          </span>
        }
      />
      {banner ? (
        <p className="bg-brand-50 text-brand-700 mb-5 rounded-xl px-4 py-3 text-sm">{banner}</p>
      ) : null}

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
        <Panel title="Photos" description="The first photo is the cover image.">
          <PhotoManager
            listingId={l.id}
            photos={media.map((m) => ({ id: m.id, url: m.url, alt: m.alt }))}
          />
        </Panel>
        <Panel title="Promotion">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Featured</p>
              <p className="text-muted mt-0.5 text-xs">
                Promoted placement for 30 days. Live listings only.
              </p>
            </div>
            <Toggle
              label="Featured"
              checked={l.isFeatured}
              disabled={!live}
              action={setMyListingFeaturedAction.bind(null, l.id)}
            />
          </div>
          <dl className="text-muted mt-5 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>Views</dt>
              <dd className="text-ink tabular">{l.viewCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Saves</dt>
              <dd className="text-ink tabular">{l.saveCount}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <ListingForm
        initial={{
          id: l.id,
          status: l.status,
          listingType: l.listingType,
          propertyType: p.propertyType,
          title: l.title,
          description: l.description,
          price: l.price,
          street: p.street,
          unit: p.unit,
          city: p.city,
          state: p.state,
          postalCode: p.postalCode,
          neighborhood: p.neighborhood,
          latitude: p.latitude,
          longitude: p.longitude,
          beds: p.beds,
          baths: p.baths,
          sqft: p.sqft,
          lotSqft: p.lotSqft,
          yearBuilt: p.yearBuilt,
          garageSpaces: p.garageSpaces,
          hoaMonthly: p.hoaMonthly,
          taxAnnual: p.taxAnnual,
          features: p.features,
          availableFrom: l.availableFrom,
          leaseTermMonths: l.leaseTermMonths,
          deposit: l.deposit,
          petsAllowed: l.petsAllowed,
          furnished: l.furnished,
        }}
      />
    </div>
  );
}
