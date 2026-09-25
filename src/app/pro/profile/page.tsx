import Link from "next/link";
import { BadgeCheck, ExternalLink, Star } from "lucide-react";
import { requirePro } from "@/server/auth/session";
import { getMyAgentProfile } from "@/server/pro/queries";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ProfileForm } from "@/components/pro/profile-form";

export const metadata = { title: "Agent profile" };

export default async function ProfilePage() {
  const user = await requirePro();
  const row = await getMyAgentProfile(user.id);
  const p = row?.p;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Agent profile"
        description="What buyers and renters see in the agent directory."
        actions={
          p ? (
            <Link
              href={`/agents/${p.slug}`}
              className="text-brand-600 inline-flex items-center gap-1 text-sm"
              target="_blank"
            >
              View public profile <ExternalLink className="size-3.5" />
            </Link>
          ) : null
        }
      />
      {p ? (
        <div className="text-muted mb-5 flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Star className="text-gold-500 size-4" /> {p.ratingAvg.toFixed(1)} · {p.reviewCount}{" "}
            reviews
          </span>
          <span className="flex items-center gap-1">
            <BadgeCheck className={p.verified ? "text-brand-600 size-4" : "size-4"} />
            {p.verified
              ? "Verified license"
              : "Not yet verified — an admin checks your license number"}
          </span>
          {row?.brokerage ? <span>{row.brokerage}</span> : null}
        </div>
      ) : null}
      <Panel>
        <ProfileForm
          p={{
            headline: p?.headline ?? null,
            bio: p?.bio ?? null,
            phone: p?.phone ?? user.phone ?? null,
            licenseNumber: p?.licenseNumber ?? null,
            licenseState: p?.licenseState ?? null,
            yearsExperience: p?.yearsExperience ?? null,
            specialties: p?.specialties ?? [],
            languages: p?.languages ?? [],
            serviceAreas: p?.serviceAreas ?? [],
            acceptingClients: p?.acceptingClients ?? true,
          }}
        />
      </Panel>
    </div>
  );
}
