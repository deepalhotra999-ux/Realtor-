import { Info } from "lucide-react";
import { getSettings } from "@/server/settings";

export async function DemoBanner() {
  const general = await getSettings("general");
  if (!general.demoDataNotice) return null;
  return (
    <div className="border-gold-500/20 bg-gold-100/70 text-gold-700 border-b">
      <p className="mx-auto flex max-w-[1440px] items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium">
        <Info className="size-3.5 shrink-0" />
        Demo marketplace — all listings, agents and reviews are fictional sample data.
      </p>
    </div>
  );
}
