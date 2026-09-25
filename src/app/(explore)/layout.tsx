import { SiteHeader } from "@/components/layout/site-header";
import { CompareTray } from "@/components/listing/compare-tray";

/** Full-viewport app layout (no footer) for map-based exploration. */
export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <main className="min-h-0 flex-1">{children}</main>
      <CompareTray />
    </div>
  );
}
