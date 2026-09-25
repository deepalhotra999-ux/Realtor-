import { describe, expect, it } from "vitest";
import { affordablePrice, amortizationByYear, calculateMortgage, monthlyPayment } from "./mortgage";

describe("mortgage maths", () => {
  it("matches the standard amortisation formula", () => {
    // $300k at 6% for 30 years ≈ $1,798.65
    expect(monthlyPayment(300_000, 6, 30)).toBeCloseTo(1798.65, 1);
    expect(monthlyPayment(120_000, 0, 10)).toBe(1000);
    expect(monthlyPayment(0, 6, 30)).toBe(0);
  });

  it("breaks down the full monthly cost with PMI under 20% down", () => {
    const b = calculateMortgage({
      price: 500_000,
      downPayment: 50_000,
      ratePct: 6,
      termYears: 30,
      taxAnnual: 6000,
      insuranceAnnual: 1800,
      hoaMonthly: 100,
    });
    expect(b.loanAmount).toBe(450_000);
    expect(b.tax).toBe(500);
    expect(b.insurance).toBe(150);
    expect(b.pmi).toBeGreaterThan(0);
    expect(b.total).toBeCloseTo(b.principalAndInterest + 500 + 150 + 100 + b.pmi, 6);
    expect(
      calculateMortgage({ price: 500_000, downPayment: 100_000, ratePct: 6, termYears: 30 }).pmi,
    ).toBe(0);
  });

  it("amortises the loan to zero", () => {
    const years = amortizationByYear(200_000, 5, 15);
    expect(years).toHaveLength(15);
    expect(years.at(-1)!.balance).toBeLessThan(1);
    const principal = years.reduce((s, y) => s + y.principalPaid, 0);
    expect(principal).toBeCloseTo(200_000, 0);
    expect(years[0].interestPaid).toBeGreaterThan(years[14].interestPaid);
  });

  it("finds an affordable price that fits the DTI budget", () => {
    const price = affordablePrice({
      annualIncome: 150_000,
      downPayment: 80_000,
      ratePct: 6.5,
      termYears: 30,
    });
    const cost = calculateMortgage({
      price,
      downPayment: 80_000,
      ratePct: 6.5,
      termYears: 30,
    }).total;
    expect(cost).toBeLessThanOrEqual((150_000 / 12) * 0.36 + 1);
    expect(price).toBeGreaterThan(350_000);
    expect(
      affordablePrice({
        annualIncome: 10_000,
        monthlyDebts: 2000,
        downPayment: 0,
        ratePct: 6,
        termYears: 30,
      }),
    ).toBe(0);
  });
});
