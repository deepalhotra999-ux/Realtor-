"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { verifications } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import {
  confirmContactCode,
  decideVerification,
  requestContactCode,
  submitDocumentCheck,
  VerificationError,
} from "@/server/trust/verification";
import { getIdentityVerification } from "@/providers";

export type VerifyState =
  { ok?: boolean; error?: string; message?: string; devCode?: string; sentTo?: string } | undefined;

const PATH = "/account/verification";

function fail(err: unknown): VerifyState {
  if (err instanceof VerificationError) return { error: err.message };
  throw err;
}

export async function requestCodeAction(
  kind: "email" | "phone",
  _prev: VerifyState,
  form: FormData,
): Promise<VerifyState> {
  const user = await requireUser(PATH);
  try {
    const res = await requestContactCode(
      user,
      z.enum(["email", "phone"]).parse(kind),
      String(form.get("phone") ?? ""),
    );
    revalidatePath(PATH);
    return {
      ok: true,
      sentTo: res.sentTo,
      devCode: res.devCode,
      message: `Code sent to ${res.sentTo}.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function confirmCodeAction(
  kind: "email" | "phone",
  _prev: VerifyState,
  form: FormData,
): Promise<VerifyState> {
  const user = await requireUser(PATH);
  const code = z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .safeParse(form.get("code"));
  if (!code.success) return { error: "Enter the 6-digit code." };
  try {
    const level = await confirmContactCode(
      user.id,
      z.enum(["email", "phone"]).parse(kind),
      code.data,
    );
    revalidatePath(PATH);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `${kind === "email" ? "Email" : "Phone"} verified. You're at level ${level}.`,
    };
  } catch (err) {
    return fail(err);
  }
}

const identitySchema = z.object({
  legalName: z.string().trim().min(3, "Enter your full legal name.").max(120),
  documentType: z.enum(["passport", "driver_license", "state_id", "other"]),
  documentCountry: z.string().trim().min(2).max(56),
});

const licenseSchema = z.object({
  licenseNumber: z.string().trim().min(3, "Enter your license number.").max(40),
  licenseState: z.string().trim().length(2, "Use the 2-letter state code.").toUpperCase(),
  brokerageName: z.string().trim().max(120).optional(),
});

export async function submitDocumentCheckAction(
  kind: "identity" | "license",
  _prev: VerifyState,
  form: FormData,
): Promise<VerifyState> {
  const user = await requireUser(PATH);
  const schema = kind === "identity" ? identitySchema : licenseSchema;
  const parsed = schema.safeParse(
    Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string" && v !== "")),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const files = form.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Attach a photo or scan of the document." };
  try {
    await submitDocumentCheck(user, kind, parsed.data as Record<string, string>, files);
    revalidatePath(PATH);
    return {
      ok: true,
      message: "Submitted. A reviewer will check it — usually within one business day.",
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Development only: decide your own pending check so the flow can be tested
 * without a second (admin) account. Refused whenever the provider disallows
 * simulation — i.e. always in production.
 */
export async function simulateDecisionAction(
  verificationId: string,
  decision: "approved" | "rejected",
) {
  const user = await requireUser(PATH);
  if (!getIdentityVerification().allowsSimulation) throw new Error("Simulation is disabled.");
  const [v] = await getDb()
    .select({ id: verifications.id })
    .from(verifications)
    .where(
      and(
        eq(verifications.id, z.string().uuid().parse(verificationId)),
        eq(verifications.userId, user.id),
        eq(verifications.status, "pending"),
      ),
    )
    .limit(1);
  if (!v) return;
  await decideVerification(
    v.id,
    z.enum(["approved", "rejected"]).parse(decision),
    decision === "approved"
      ? "Simulated approval (development)"
      : "Simulated rejection (development)",
    { type: "system", rule: "dev-simulation" },
  );
  revalidatePath(PATH);
}
