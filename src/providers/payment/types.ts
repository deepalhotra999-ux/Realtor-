export interface CheckoutRequest {
  userId: string;
  email: string;
  planId: string;
  planKey: string;
  planName: string;
  /** Minor units (cents) charged per interval. */
  amount: number;
  currency: string;
  interval: "month" | "year";
  trialDays: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  /** Where to send the user to pay (hosted page, or our mock page). */
  url: string;
}

export interface CheckoutResult {
  status: "paid" | "trialing" | "failed" | "canceled";
  request: CheckoutRequest;
  /** Provider-side subscription reference. */
  providerRef: string;
  paymentRef?: string;
}

/**
 * Payment processing. Only a mock ships (no money moves) so the platform runs
 * free. A Stripe/Paddle/LemonSqueezy adapter implements this interface and is
 * registered in providers/index.ts — billing logic above it does not change.
 */
export interface PaymentProvider {
  readonly name: string;
  readonly isLive: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Resolve a checkout after the user returns. `simulate` is only honoured by
   * the mock provider (its checkout page offers success/failure buttons).
   */
  completeCheckout(sessionId: string, simulate?: "succeed" | "fail"): Promise<CheckoutResult>;
  cancelSubscription(providerRef: string, opts: { atPeriodEnd: boolean }): Promise<void>;
}
