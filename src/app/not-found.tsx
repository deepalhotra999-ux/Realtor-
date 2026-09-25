import Link from "next/link";
import { Logo } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Link href="/">
        <Logo />
      </Link>
      <p className="font-display text-brand-600 mt-10 text-7xl">404</p>
      <h1 className="font-display mt-3 text-3xl">This page has moved out</h1>
      <p className="text-muted mt-2 max-w-md">
        The listing may have sold or the link is incorrect.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/search"
          className="bg-brand-600 hover:bg-brand-700 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
        >
          Search homes
        </Link>
        <Link
          href="/"
          className="border-line bg-surface rounded-full border px-5 py-2.5 text-sm font-semibold"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
