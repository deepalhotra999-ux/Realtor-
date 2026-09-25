import Link from "next/link";
import { requireWorkspace } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { accountLimits } from "@/server/trust/permissions";
import { publishDecision } from "@/lib/trust";
import { PageHeader } from "@/components/admin/ui";
import { ListingForm } from "@/components/pro/listing-form";

export const metadata = { title: "New listing" };

export default async function NewListingPage() {
  const user = await requireWorkspace();
  const [general, { account, trust }] = await Promise.all([
    getSettings("general"),
    accountLimits(user.id),
  ]);
  const publish = publishDecision(account.role, account.level, trust);
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="New listing"
        description={
          general.requireListingApproval || (publish.allowed && publish.needsReview)
            ? "Listings are reviewed before going live."
            : "Save a draft now and publish whenever you're ready. Add photos after the first save."
        }
      />
      {!publish.allowed && publish.reason === "level" ? (
        <p className="bg-gold-100 text-gold-700 mb-5 rounded-xl px-4 py-3 text-sm">
          You can save drafts now. Publishing needs verification level {publish.requiredLevel} —
          you&apos;re at level {account.level}.{" "}
          <Link href="/account/verification" className="font-semibold underline">
            Verify your account
          </Link>
        </p>
      ) : null}
      <ListingForm
        initial={{
          listingType: "sale",
          propertyType: "single_family",
          title: "",
          description: "",
          price: null,
          street: "",
          unit: null,
          city: "",
          state: "",
          postalCode: "",
          neighborhood: null,
          latitude: null,
          longitude: null,
          beds: null,
          baths: null,
          sqft: null,
          lotSqft: null,
          yearBuilt: null,
          garageSpaces: null,
          hoaMonthly: null,
          taxAnnual: null,
          features: [],
          availableFrom: null,
          leaseTermMonths: null,
          deposit: null,
          petsAllowed: null,
          furnished: null,
        }}
      />
    </div>
  );
}
