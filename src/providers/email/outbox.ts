import type { DeliveryResult, EmailMessage, EmailProvider } from "./types";

/**
 * Development/free email: nothing leaves the machine. The notification service
 * persists every message to `outbound_messages`, so this provider only logs.
 */
export class OutboxEmailProvider implements EmailProvider {
  readonly name = "outbox";

  async send(message: EmailMessage): Promise<DeliveryResult> {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email:outbox] → ${message.to} · ${message.subject}`);
    }
    return { status: "sent", providerRef: `outbox-${Date.now().toString(36)}` };
  }
}
