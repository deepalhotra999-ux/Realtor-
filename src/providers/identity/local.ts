import { randomUUID } from "node:crypto";
import type {
  IdentityCheckRequest,
  IdentityCheckResult,
  IdentityVerificationProvider,
} from "./types";

/**
 * Free, local identity verification: every check is queued for manual review
 * by an admin (who sees the submitted details and any private evidence). No
 * data leaves the server. In development, the UI may offer simulated
 * decisions so the flow can be tested end to end.
 */
export class LocalIdentityProvider implements IdentityVerificationProvider {
  readonly name = "local-review";

  constructor(readonly allowsSimulation: boolean) {}

  async start(_req: IdentityCheckRequest): Promise<IdentityCheckResult> {
    void _req;
    return { ref: `local_${randomUUID()}`, status: "pending" };
  }

  async status(ref: string): Promise<IdentityCheckResult> {
    // Decisions are recorded by admins in our own database, not here.
    return { ref, status: "pending" };
  }
}
