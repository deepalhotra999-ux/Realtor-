import { requirePro } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/ui";
import { ListingForm } from "@/components/pro/listing-form";

export const metadata = { title: "New listing" };

export default async function NewListingPage() {
  await requirePro();
  const general = await getSettings("general");
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="New listing"
        description={
          general.requireListingApproval
            ? "Listings are reviewed by an admin before going live."
            : "Save a draft now and publish whenever you're ready. Add photos after the first save."
        }
      />
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
