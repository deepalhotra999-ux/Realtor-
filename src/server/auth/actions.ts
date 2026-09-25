"use server";

import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { agentProfiles, auditLogs, users } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { slugify } from "@/lib/slug";
import { hashPassword, passwordProblems, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

export type AuthState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

/** Only allow same-origin relative redirects. */
function safeNext(next: FormDataEntryValue | null, fallback = "/") {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const [user] = await getDb()
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`)
    .limit(1);
  // Always run a hash comparison to keep timing uniform for unknown emails.
  const ok = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? "scrypt$16384$8$1$AAAA$AAAA",
  );
  if (!user || !ok) return { error: "That email and password don't match." };
  if (user.status === "suspended") return { error: "This account is suspended. Contact support." };

  await createSession(user.id);
  const fallback = user.role === "admin" ? "/admin" : user.role === "consumer" ? "/" : "/pro";
  redirect(safeNext(form.get("next"), fallback));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string(),
  role: z.enum(["consumer", "agent", "broker", "property_manager"]).default("consumer"),
});

export async function registerAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const general = await getSettings("general");
  if (!general.allowRegistration) return { error: "New registrations are currently closed." };

  const parsed = registerSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
    role: form.get("role") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const problem = passwordProblems(parsed.data.password);
  if (problem) return { fieldErrors: { password: problem } };

  // Pro sign-ups always succeed; if free agent accounts are OFF (and the
  // subscription system ON) the workspace asks them to choose a plan.
  const pro = parsed.data.role !== "consumer";

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`)
    .limit(1);
  if (existing.length)
    return { fieldErrors: { email: "An account with this email already exists." } };

  const [user] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    })
    .returning();

  if (pro) {
    await db.insert(agentProfiles).values({
      userId: user.id,
      slug: `${slugify(user.name)}-${user.id.slice(0, 6)}`,
      headline:
        parsed.data.role === "property_manager" ? "Property manager" : "Real estate professional",
    });
  }
  await db
    .insert(auditLogs)
    .values({
      actorId: user.id,
      action: "user.register",
      targetType: "user",
      targetId: user.id,
      meta: { role: user.role },
    });
  await createSession(user.id);
  redirect(safeNext(form.get("next"), pro ? "/pro" : "/"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
