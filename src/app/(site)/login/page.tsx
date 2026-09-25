import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  if (await getCurrentUser())
    redirect(typeof next === "string" && next.startsWith("/") ? next : "/");
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your saved homes, boards and conversations."
      aside={
        <div className="flex h-full flex-col">
          <p className="font-display text-3xl leading-tight">
            “We found our place in a weekend — and agreed on it together.”
          </p>
          <p className="text-brand-100 mt-4">
            Shared boards let everyone vote and comment on homes in one place.
          </p>
          <div className="text-brand-50 mt-10 rounded-2xl bg-white/10 p-5 text-sm backdrop-blur">
            <p className="font-semibold text-white">Demo accounts</p>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              <li>buyer@dwellwise.local · demo12345</li>
              <li>agent@dwellwise.local · demo12345</li>
              <li>admin@dwellwise.local · admin12345</li>
            </ul>
          </div>
        </div>
      }
    >
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </AuthShell>
  );
}
