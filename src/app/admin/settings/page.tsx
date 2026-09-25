import { getSettings } from "@/server/settings";
import { listFeaturesAdmin } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/session";
import { AISettingsForm, GeneralSettingsForm, MonetizationForm } from "@/components/admin/forms";
import { FilterTabs, PageHeader, Panel } from "@/components/admin/ui";
import { TrustSettingsForm } from "@/components/admin/trust-forms";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Settings" };

const TABS = [
  { value: "general", label: "General" },
  { value: "monetization", label: "Monetization" },
  { value: "ai", label: "AI" },
  { value: "trust", label: "Trust & verification" },
] as const;

export default async function SettingsPage(props: PageProps<"/admin/settings">) {
  const sp = (await props.searchParams) as SP;
  await requireAdmin();
  const raw = str(sp, "tab", "general");
  const tab = TABS.some((t) => t.value === raw) ? raw : "general";

  return (
    <>
      <PageHeader
        title="Settings"
        description="Platform-wide configuration. Changes apply within a few seconds and are recorded in the audit log."
      />
      <FilterTabs
        current={tab}
        tabs={TABS.map((t) => ({ ...t, href: `/admin/settings?tab=${t.value}` }))}
      />
      <div className="max-w-3xl">
        {tab === "general" ? (
          <Panel title="General" description="Branding, registration and moderation defaults.">
            <GeneralSettingsForm s={await getSettings("general")} />
          </Panel>
        ) : tab === "monetization" ? (
          <MonetizationPanel />
        ) : tab === "trust" ? (
          <Panel
            title="Trust & verification"
            description="Who may publish, verification rules, new-account limits and the strike ladder."
          >
            <TrustSettingsForm s={await getSettings("trust")} />
          </Panel>
        ) : (
          <Panel
            title="AI features"
            description="Every AI feature has a rule-based fallback, so turning the model off never breaks a page."
          >
            <AISettingsForm s={await getSettings("ai")} />
          </Panel>
        )}
      </div>
    </>
  );
}

async function MonetizationPanel() {
  const [s, features] = await Promise.all([getSettings("monetization"), listFeaturesAdmin()]);
  return (
    <Panel
      title="Monetization"
      description="The platform is free until you switch the subscription system on."
    >
      <MonetizationForm
        s={s}
        features={features.map((f) => ({ key: f.key, name: f.name, category: f.category }))}
      />
    </Panel>
  );
}
