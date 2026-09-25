import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { CheckoutRequest, CheckoutResult, CheckoutSession, PaymentProvider } from "./types";

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

/**
 * Simulated payments. Checkout sessions are stateless HMAC-signed tokens that
 * expire after an hour; the mock checkout page lets you simulate success or a
 * declined card. No card data is collected and no money moves.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly isLive = false;

  constructor(
    private readonly secret: string,
    private readonly appUrl: string,
  ) {}

  private sign(payload: string) {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const payload = b64(
      JSON.stringify({ req, exp: Date.now() + 60 * 60 * 1000, nonce: randomUUID() }),
    );
    const id = `${payload}.${this.sign(payload)}`;
    return {
      id,
      url: `${this.appUrl.replace(/\/$/, "")}/billing/checkout?session=${encodeURIComponent(id)}`,
    };
  }

  /** Verify and decode a session token. Throws on tampering or expiry. */
  decode(sessionId: string): CheckoutRequest {
    const [payload, sig] = sessionId.split(".");
    if (!payload || !sig) throw new Error("Malformed checkout session");
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new Error("Invalid checkout session signature");
    }
    const { req, exp } = JSON.parse(unb64(payload)) as { req: CheckoutRequest; exp: number };
    if (Date.now() > exp) throw new Error("Checkout session expired");
    return req;
  }

  async completeCheckout(
    sessionId: string,
    simulate: "succeed" | "fail" = "succeed",
  ): Promise<CheckoutResult> {
    const request = this.decode(sessionId);
    const providerRef = `mock_sub_${randomUUID()}`;
    if (simulate === "fail") return { status: "failed", request, providerRef };
    return {
      status: request.trialDays > 0 ? "trialing" : "paid",
      request,
      providerRef,
      paymentRef: request.trialDays > 0 ? undefined : `mock_pay_${randomUUID()}`,
    };
  }

  async cancelSubscription(): Promise<void> {
    // Nothing to do remotely — the billing service updates local state.
  }
}
