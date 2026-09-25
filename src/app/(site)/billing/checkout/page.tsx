import type { Metadata } from "next";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { completeCheckoutAction } from "@/server/actions/billing";
import { getPayments } from "@/providers";
import { MockPaymentProvider } from "@/providers/payment/mock";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { formatCents } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/**
 * Checkout page for the mock PaymentProvider. A hosted provider (Stripe etc.)
 * would redirect to its own page instead, so this page only renders for mock.
 */
export default async function CheckoutPage(props: PageProps<"/billing/checkout">) {
  const sp = (await props.searchParams) as SP;
  const user = await requireUser("/pricing");
  const session = str(sp, "session");
  const provider = getPayments();
  let req = null;
  if (provider instanceof MockPaymentProvider) {
    try {
      req = provider.decode(session);
    } catch {
      req = null;
    }
  }
  if (!req || req.userId !== user.id)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Checkout expired</h1>
        <p className="text-muted mt-3">This checkout link is invalid or has expired.</p>
        <ButtonLink href="/pricing" className="mt-6">
          Back to pricing
        </ButtonLink>
      </div>
    );

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="bg-gold-100 text-gold-700 mb-5 flex items-start gap-2 rounded-xl p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        Test checkout — no card is collected and no money moves.
      </p>
      {str(sp, "declined") ? (
        <p className="bg-clay-50 text-clay-600 mb-5 rounded-xl p-3 text-sm">
          The simulated card was declined. Try again, or pick another option.
        </p>
      ) : null}
      <Card className="p-6">
        <p className="text-muted text-sm">Subscribe to</p>
        <h1 className="mt-1 text-2xl font-semibold">{req.planName}</h1>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Billed</dt>
            <dd>{req.interval === "year" ? "Annually" : "Monthly"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Price</dt>
            <dd className="tabular">{formatCents(req.amount, req.currency)}</dd>
          </div>
          {req.trialDays > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">Free trial</dt>
              <dd>{req.trialDays} days</dd>
            </div>
          ) : null}
          <div className="border-line flex justify-between border-t pt-2 font-semibold">
            <dt>Due today</dt>
            <dd className="tabular">
              {formatCents(req.trialDays > 0 ? 0 : req.amount, req.currency)}
            </dd>
          </div>
        </dl>
        <form action={completeCheckoutAction.bind(null, session, "succeed")} className="mt-6">
          <Button type="submit" className="w-full" size="lg">
            <ShieldCheck className="size-4" />
            {req.trialDays > 0 ? "Start free trial" : "Simulate successful payment"}
          </Button>
        </form>
        {req.trialDays === 0 && req.amount > 0 ? (
          <form action={completeCheckoutAction.bind(null, session, "fail")} className="mt-2">
            <Button type="submit" variant="ghost" className="w-full">
              Simulate declined card
            </Button>
          </form>
        ) : null}
        <ButtonLink href="/pricing?checkout=canceled" variant="link" className="mt-4 w-full">
          Cancel
        </ButtonLink>
      </Card>
    </div>
  );
}
