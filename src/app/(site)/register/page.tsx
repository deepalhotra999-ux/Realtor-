import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create your account" };

const PERKS = [
  "Save homes and get alerts when prices drop",
  "Plan your search with a partner on shared boards",
  "Ask the AI assistant about any listing",
  "Agents & managers: list, track leads and schedule tours",
];

export default async function RegisterPage(props: PageProps<"/register">) {
  const { next, role } = await props.searchParams;
  return (
    <AuthShell
      title="Create your free account"
      subtitle="Everything on Dwellwise is free while we grow — no card required."
      aside={
        <div>
          <p className="font-display text-3xl leading-tight">A calmer way to find home.</p>
          <ul className="mt-8 space-y-4">
            {PERKS.map((p) => (
              <li key={p} className="text-brand-50 flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Check className="size-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <RegisterForm
        next={typeof next === "string" ? next : undefined}
        defaultRole={typeof role === "string" ? role : "consumer"}
      />
    </AuthShell>
  );
}
