import type { Metadata } from "next";
import { HomeFinder } from "@/components/ai/home-finder";

export const metadata: Metadata = { title: "AI Home Finder" };

export default function AIPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-3xl">
        <p className="text-brand-600 text-xs font-semibold tracking-[0.14em] uppercase">
          AI Home Finder
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">Tell us how you live.</h1>
        <p className="text-muted mt-3">
          Runs on open-source models on our own servers — your conversation never goes to a
          third-party AI company. Every recommendation is explained with real listing facts.
        </p>
      </div>
      <HomeFinder />
    </div>
  );
}
