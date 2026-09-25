import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { getCityStats } from "@/server/listings";
import { formatCompactPrice } from "@/lib/format";
import { slugify } from "@/lib/slug";

export const metadata: Metadata = { title: "Market insights" };

export default async function MarketIndex() {
  await connection();
  const cities = await getCityStats();
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6">
      <p className="text-brand-600 text-xs font-semibold tracking-[0.14em] uppercase">
        Market insights
      </p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">How each market is moving</h1>
      <p className="text-muted mt-3 max-w-2xl">
        Inventory, pricing and pace computed live from listings on Dwellwise. Demo markets use
        fictional data.
      </p>
      <div className="border-line bg-surface shadow-card mt-10 overflow-hidden rounded-3xl border">
        <table className="w-full text-sm">
          <thead className="bg-paper text-muted text-left text-xs">
            <tr>
              <th className="px-5 py-3 font-medium">Market</th>
              <th className="px-5 py-3 text-right font-medium">For sale</th>
              <th className="px-5 py-3 text-right font-medium">Median ask</th>
              <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">For rent</th>
              <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Median rent</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.city} className="border-line hover:bg-paper/60 border-t">
                <td className="px-5 py-4 font-semibold">
                  {c.city}, {c.state}
                </td>
                <td className="tabular px-5 py-4 text-right">{c.forSale}</td>
                <td className="tabular px-5 py-4 text-right">
                  {c.medianSale ? formatCompactPrice(c.medianSale) : "—"}
                </td>
                <td className="tabular hidden px-5 py-4 text-right sm:table-cell">{c.forRent}</td>
                <td className="tabular hidden px-5 py-4 text-right sm:table-cell">
                  {c.medianRent ? `$${c.medianRent.toLocaleString("en-US")}` : "—"}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/market/${slugify(`${c.city} ${c.state}`)}`}
                    className="text-brand-600 inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    Report <ArrowRight className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
