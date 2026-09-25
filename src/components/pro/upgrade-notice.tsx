import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { EntitlementDecision } from "@/lib/entitlements/engine";

/** Shown in place of a gated pro feature when the user's plan doesn't include it. */
export function UpgradeNotice({
  feature,
  decision,
}: {
  feature: string;
  decision: EntitlementDecision;
}) {
  const off = decision.reason === "disabled_globally";
  return (
    <div className="border-line-strong bg-surface/60 flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="bg-gold-100 text-gold-700 mb-4 flex size-12 items-center justify-center rounded-2xl">
        <Lock className="size-5" />
      </div>
      <h2 className="font-display text-xl">
        {off ? `${feature} is turned off` : `${feature} isn't included in your plan`}
      </h2>
      <p className="text-muted mt-2 max-w-md text-sm">
        {off
          ? "An administrator has disabled this feature for the whole platform."
          : "Upgrade to unlock it. Plans can be cancelled any time."}
      </p>
      {off ? null : (
        <ButtonLink href="/pricing" className="mt-6">
          See plans
        </ButtonLink>
      )}
    </div>
  );
}
