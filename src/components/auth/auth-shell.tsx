import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  aside,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-ink text-4xl">{title}</h1>
        <p className="text-muted mt-3">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
      <div className="bg-brand-700 relative hidden overflow-hidden rounded-3xl p-10 text-white lg:block">
        <div className="bg-brand-500/40 absolute -top-24 -right-24 size-80 rounded-full blur-3xl" />
        <div className="bg-gold-500/20 absolute -bottom-32 -left-10 size-96 rounded-full blur-3xl" />
        <div className="relative">{aside}</div>
      </div>
    </div>
  );
}
