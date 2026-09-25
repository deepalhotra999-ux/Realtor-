export type IdentityCheckKind = "identity" | "license" | "ownership";

export interface IdentityCheckRequest {
  userId: string;
  kind: IdentityCheckKind;
  /** Non-sensitive fields the user supplied (legal name, license number …). */
  fields: Record<string, string>;
  /** Storage keys of any evidence the user uploaded (kept private). */
  documentKeys: string[];
}

export interface IdentityCheckResult {
  /** Provider reference used to look the check up later. */
  ref: string;
  /**
   * `pending` means a human (admin) must review; `approved`/`rejected` means the
   * provider decided automatically (a hosted KYC vendor would, the local one never does).
   */
  status: "pending" | "approved" | "rejected";
  reason?: string;
  /** Hosted flows redirect the user; the local provider has no redirect. */
  redirectUrl?: string;
}

/**
 * Identity / license / ownership verification. The default implementation is
 * local and free: it records the request for admin review (and, in
 * development, lets you simulate a decision). A hosted KYC provider can be
 * added later by implementing this interface and registering it in
 * providers/index.ts — the verification service above it does not change.
 */
export interface IdentityVerificationProvider {
  readonly name: string;
  /** Whether simulated approve/reject buttons may be shown (development only). */
  readonly allowsSimulation: boolean;
  start(req: IdentityCheckRequest): Promise<IdentityCheckResult>;
  /** Poll a provider-side decision (hosted providers / webhooks). */
  status(ref: string): Promise<IdentityCheckResult>;
}
