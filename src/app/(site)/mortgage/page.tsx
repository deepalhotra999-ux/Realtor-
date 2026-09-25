import type { Metadata } from "next";
import { MortgageCalculator } from "@/components/mortgage-calculator";

export const metadata: Metadata = { title: "Mortgage calculator" };

export default async function MortgagePage(props: PageProps<"/mortgage">) {
  const { price } = await props.searchParams;
  const initial = Number(price);
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <p className="text-brand-600 text-xs font-semibold tracking-[0.14em] uppercase">Tools</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Mortgage calculator</h1>
      <p className="text-muted mt-3 max-w-2xl">
        See your full monthly cost — principal, interest, taxes, insurance, HOA and mortgage
        insurance — and what fits your budget.
      </p>
      <div className="mt-10">
        <MortgageCalculator
          initialPrice={Number.isFinite(initial) && initial > 10_000 ? initial : 550_000}
        />
      </div>
    </div>
  );
}
