"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import { auditLogs, payments, plans, subscriptions } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { getCurrentSubscription } from "@/server/entitlements";
import { notify } from "@/server/notify";
import { getPayments } from "@/providers";
import { trialDaysFor } from "@/lib/entitlements/engine";
import { addDays, addInterval, priceFor } from "@/lib/billing";
import { formatCents } from "@/lib/format";

const LIVE = ["trialing", "active", "past_due", "canceled"] as const;

export async function startCheckoutAction(planId: string, interval: "month" | "year") {
  const user = await requireUser("/pricing");
  const id = z.string().uuid().parse(planId);
  const iv = z.enum(["month", "year"]).parse(interval);
  const settings = await getSettings("monetization");
  if (!settings.subscriptionsEnabled) redirect("/pricing?free=1");

  const db = getDb();
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, id), eq(plans.isActive, true)))
    .limit(1);
  if (!plan) redirect("/pricing?error=plan");

  // One trial per account: anyone who has trialled before pays from day one.
  const [trialled] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), isNotNull(subscriptions.trialEndsAt)))
    .limit(1);
  const trialDays = trialled ? 0 : trialDaysFor(plan.trialDays, settings);
  const amount = priceFor(plan, iv);

  const session = await getPayments().createCheckout({
    userId: user.id,
    email: user.email,
    planId: plan.id,
    planKey: plan.key,
    planName: plan.name,
    amount,
    currency: plan.currency,
    interval: iv,
    trialDays: amount === 0 ? 0 : trialDays,
    successUrl: "/billing?checkout=success",
    cancelUrl: "/pricing?checkout=canceled",
  });
  redirect(session.url);
}

export async function completeCheckoutAction(sessionId: string, simulate: "succeed" | "fail") {
  const user = await requireUser("/billing");
  const provider = getPayments();
  let result;
  try {
    result = await provider.completeCheckout(sessionId, simulate);
  } catch {
    redirect("/pricing?checkout=expired");
  }
  const req = result.request;
  if (req.userId !== user.id) redirect("/pricing?checkout=expired");
  const db = getDb();

  if (result.status === "failed" || result.status === "canceled") {
    await db.insert(payments).values({
      userId: user.id,
      amount: req.amount,
      currency: req.currency,
      status: "failed",
      description: `${req.planName} (${req.interval}ly) — declined`,
      provider: provider.name,
      providerRef: result.paymentRef ?? null,
    });
    redirect("/billing/checkout?session=" + encodeURIComponent(sessionId) + "&declined=1");
  }

  // Idempotency: a double-submitted checkout must not create two subscriptions.
  const [recent] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, user.id),
        eq(subscriptions.planId, req.planId),
        inArray(subscriptions.status, ["trialing", "active"]),
        gt(subscriptions.createdAt, new Date(Date.now() - 10 * 60_000)),
      ),
    )
    .limit(1);
  if (recent) redirect("/billing?checkout=success");

  const now = new Date();
  const trialing = result.status === "trialing";
  await db
    .update(subscriptions)
    .set({ status: "expired", currentPeriodEnd: now })
    .where(and(eq(subscriptions.userId, user.id), inArray(subscriptions.status, [...LIVE])));
  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      planId: req.planId,
      status: trialing ? "trialing" : "active",
      interval: req.interval,
      trialEndsAt: trialing ? addDays(now, req.trialDays) : null,
      currentPeriodStart: now,
      currentPeriodEnd: trialing ? addDays(now, req.trialDays) : addInterval(now, req.interval),
      provider: provider.name,
      providerRef: result.providerRef,
    })
    .returning({ id: subscriptions.id });
  if (!trialing && req.amount > 0)
    await db.insert(payments).values({
      userId: user.id,
      subscriptionId: sub.id,
      amount: req.amount,
      currency: req.currency,
      status: "succeeded",
      description: `${req.planName} (${req.interval}ly)`,
      provider: provider.name,
      providerRef: result.paymentRef ?? null,
    });
  await db.insert(auditLogs).values({
    actorId: user.id,
    action: "subscription.checkout",
    targetType: "subscription",
    targetId: sub.id,
    meta: { plan: req.planKey, interval: req.interval, trialing },
  });
  await notify(
    user.id,
    {
      type: "billing",
      title: trialing ? `Your ${req.planName} trial has started` : `Welcome to ${req.planName}`,
      body: trialing
        ? `Your ${req.trialDays}-day free trial is active. You won't be charged until it ends, and you can cancel any time from Billing.`
        : `We received your payment of ${formatCents(req.amount, req.currency)}. Your plan is active.`,
      link: "/billing",
    },
    { email: true },
  );
  revalidatePath("/billing");
  redirect("/billing?checkout=success");
}

async function mySubscription(userId: string) {
  const current = await getCurrentSubscription(userId);
  if (!current) throw new Error("No subscription.");
  return current;
}

export async function cancelMySubscriptionAction() {
  const user = await requireUser("/billing");
  const { sub, plan } = await mySubscription(user.id);
  if (sub.providerRef)
    await getPayments().cancelSubscription(sub.providerRef, { atPeriodEnd: true });
  const endsAt =
    sub.status === "trialing" && sub.trialEndsAt ? sub.trialEndsAt : sub.currentPeriodEnd;
  await getDb()
    .update(subscriptions)
    .set({
      status: "canceled",
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
      currentPeriodEnd: endsAt,
    })
    .where(eq(subscriptions.id, sub.id));
  await notify(
    user.id,
    {
      type: "billing",
      title: `${plan.name} cancelled`,
      body: `You'll keep access until ${endsAt.toLocaleDateString("en-US")}. You can resume any time before then.`,
      link: "/billing",
    },
    { email: true },
  );
  revalidatePath("/billing");
}

export async function resumeMySubscriptionAction() {
  const user = await requireUser("/billing");
  const { sub } = await mySubscription(user.id);
  if (sub.status !== "canceled" || sub.currentPeriodEnd <= new Date()) return;
  const trialing = sub.trialEndsAt !== null && sub.trialEndsAt > new Date();
  await getDb()
    .update(subscriptions)
    .set({ status: trialing ? "trialing" : "active", cancelAtPeriodEnd: false, canceledAt: null })
    .where(eq(subscriptions.id, sub.id));
  revalidatePath("/billing");
}
