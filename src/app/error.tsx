"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="text-muted mt-2 max-w-md">
        Please try again. If you&apos;re running locally, check that PostgreSQL is running and
        migrations are applied (<code>pnpm setup</code>).
      </p>
      {error.digest ? (
        <p className="text-subtle mt-2 font-mono text-xs">Ref {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="bg-brand-600 mt-6 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
