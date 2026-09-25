import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "./mock";

const req = {
  userId: "u1",
  email: "a@b.c",
  planId: "p1",
  planKey: "pro",
  planName: "Pro",
  amount: 4900,
  currency: "USD",
  interval: "month" as const,
  trialDays: 0,
  successUrl: "/ok",
  cancelUrl: "/cancel",
};

describe("MockPaymentProvider", () => {
  const provider = new MockPaymentProvider("secret", "http://localhost:3000");

  it("creates signed checkout sessions that complete", async () => {
    const session = await provider.createCheckout(req);
    expect(session.url).toContain("/billing/checkout?session=");
    const result = await provider.completeCheckout(session.id);
    expect(result).toMatchObject({ status: "paid", request: req });
    expect(result.paymentRef).toMatch(/^mock_pay_/);
  });

  it("reports trials and simulated failures", async () => {
    const trial = await provider.completeCheckout(
      (await provider.createCheckout({ ...req, trialDays: 14 })).id,
    );
    expect(trial.status).toBe("trialing");
    const failed = await provider.completeCheckout((await provider.createCheckout(req)).id, "fail");
    expect(failed.status).toBe("failed");
  });

  it("rejects tampered sessions", async () => {
    const { id } = await provider.createCheckout(req);
    const [payload, sig] = id.split(".");
    const forged = Buffer.from(
      JSON.stringify({ req: { ...req, amount: 1 }, exp: Date.now() + 1e6 }),
    ).toString("base64url");
    await expect(provider.completeCheckout(`${forged}.${sig}`)).rejects.toThrow(/signature/);
    await expect(
      new MockPaymentProvider("other", "x").completeCheckout(`${payload}.${sig}`),
    ).rejects.toThrow();
  });
});
