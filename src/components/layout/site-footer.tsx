import Link from "next/link";
import { Logo } from "@/components/ui/misc";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      ["Homes for sale", "/search"],
      ["Homes for rent", "/search?type=rent"],
      ["Market insights", "/market"],
      ["AI Home Finder", "/ai"],
    ],
  },
  {
    title: "Tools",
    links: [
      ["Mortgage calculator", "/mortgage"],
      ["Compare homes", "/compare"],
      ["Shared boards", "/boards"],
      ["Saved searches", "/saved-searches"],
    ],
  },
  {
    title: "Professionals",
    links: [
      ["Find an agent", "/agents"],
      ["List a property", "/sell"],
      ["Pro workspace", "/pro"],
      ["Plans & pricing", "/pricing"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-line bg-surface mt-24 border-t">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="text-muted mt-4 max-w-xs text-sm leading-relaxed">
            An open, free-first home marketplace. Built on open-source maps, search and AI.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-ink text-sm font-semibold">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-muted hover:text-ink text-sm transition">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-line border-t">
        <div className="text-muted mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} Dwellwise. Listing data shown is fictional demo data unless
            stated otherwise.
          </p>
          <p>
            Map data ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="hover:text-ink underline"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>
            . Equal Housing Opportunity.
          </p>
        </div>
      </div>
    </footer>
  );
}
