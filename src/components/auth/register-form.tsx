"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Briefcase, Building2, Home, KeyRound } from "lucide-react";
import { registerAction, type AuthState } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "consumer", label: "Buying or renting", icon: Home },
  { value: "agent", label: "I'm an agent", icon: Briefcase },
  { value: "broker", label: "I'm a broker", icon: Building2 },
  { value: "property_manager", label: "I manage rentals", icon: KeyRound },
] as const;

export function RegisterForm({
  next,
  defaultRole = "consumer",
}: {
  next?: string;
  defaultRole?: string;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, undefined);
  const [role, setRole] = useState(defaultRole);
  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <input type="hidden" name="role" value={role} />
      <fieldset>
        <legend className="text-ink-2 mb-2 text-sm font-medium">I&apos;m here for</legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              aria-pressed={role === r.value}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition",
                role === r.value
                  ? "border-brand-500 bg-brand-50 text-brand-700 ring-brand-100 ring-4"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              <r.icon className="size-4 shrink-0" />
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters."
        error={state?.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      {state?.error ? (
        <p role="alert" className="bg-clay-50 text-clay-600 rounded-xl px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create free account"}
      </Button>
      <p className="text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
