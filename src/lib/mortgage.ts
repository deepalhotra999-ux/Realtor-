/** Mortgage and affordability maths. Pure functions, no rounding surprises. */

export interface MortgageInput {
  price: number;
  downPayment: number;
  /** Annual interest rate in percent, e.g. 6.5 */
  ratePct: number;
  termYears: number;
  /** Annual property tax in currency units. */
  taxAnnual?: number;
  /** Annual homeowners insurance. */
  insuranceAnnual?: number;
  hoaMonthly?: number;
  /** Annual PMI rate in percent of the loan, applied while LTV > 80%. */
  pmiRatePct?: number;
}

export interface MortgageBreakdown {
  loanAmount: number;
  principalAndInterest: number;
  tax: number;
  insurance: number;
  hoa: number;
  pmi: number;
  total: number;
  totalInterest: number;
  downPaymentPct: number;
  ltv: number;
}

export function monthlyPayment(principal: number, ratePct: number, termYears: number): number {
  const n = termYears * 12;
  if (principal <= 0 || n <= 0) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function calculateMortgage(input: MortgageInput): MortgageBreakdown {
  const price = Math.max(0, input.price);
  const down = Math.min(Math.max(0, input.downPayment), price);
  const loanAmount = price - down;
  const pi = monthlyPayment(loanAmount, input.ratePct, input.termYears);
  const ltv = price > 0 ? loanAmount / price : 0;
  const pmi = ltv > 0.8 ? (loanAmount * (input.pmiRatePct ?? 0.5)) / 100 / 12 : 0;
  const tax = (input.taxAnnual ?? price * 0.011) / 12;
  const insurance = (input.insuranceAnnual ?? price * 0.0035) / 12;
  const hoa = input.hoaMonthly ?? 0;
  return {
    loanAmount,
    principalAndInterest: pi,
    tax,
    insurance,
    hoa,
    pmi,
    total: pi + tax + insurance + hoa + pmi,
    totalInterest: pi * input.termYears * 12 - loanAmount,
    downPaymentPct: price > 0 ? (down / price) * 100 : 0,
    ltv: ltv * 100,
  };
}

export interface AmortizationYear {
  year: number;
  principalPaid: number;
  interestPaid: number;
  balance: number;
}

export function amortizationByYear(
  loan: number,
  ratePct: number,
  termYears: number,
): AmortizationYear[] {
  const payment = monthlyPayment(loan, ratePct, termYears);
  const r = ratePct / 100 / 12;
  let balance = loan;
  const out: AmortizationYear[] = [];
  for (let year = 1; year <= termYears; year++) {
    let principalPaid = 0;
    let interestPaid = 0;
    for (let m = 0; m < 12 && balance > 0.005; m++) {
      const interest = balance * r;
      const principal = Math.min(payment - interest, balance);
      balance -= principal;
      principalPaid += principal;
      interestPaid += interest;
    }
    out.push({ year, principalPaid, interestPaid, balance: Math.max(0, balance) });
  }
  return out;
}

/**
 * Maximum home price for a gross annual income using a debt-to-income cap
 * (default 36% back-end), existing monthly debts and the same cost model.
 */
export function affordablePrice(opts: {
  annualIncome: number;
  monthlyDebts?: number;
  downPayment: number;
  ratePct: number;
  termYears: number;
  dtiPct?: number;
  hoaMonthly?: number;
}): number {
  const budget = (opts.annualIncome / 12) * ((opts.dtiPct ?? 36) / 100) - (opts.monthlyDebts ?? 0);
  if (budget <= 0) return 0;
  // Total monthly cost is monotonic in price → binary search.
  let lo = 0;
  let hi = 20_000_000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const cost = calculateMortgage({
      price: mid,
      downPayment: Math.min(opts.downPayment, mid),
      ratePct: opts.ratePct,
      termYears: opts.termYears,
      hoaMonthly: opts.hoaMonthly,
    }).total;
    if (cost > budget) hi = mid;
    else lo = mid;
  }
  return Math.floor(lo / 1000) * 1000;
}

/** Illustrative default rate used when the user hasn't entered one. Not a quote. */
export const DEFAULT_RATE_PCT = 6.5;
