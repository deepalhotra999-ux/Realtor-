export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface DeliveryResult {
  status: "sent" | "queued" | "failed";
  providerRef?: string;
  error?: string;
}

/**
 * Outbound email. Implementations: local outbox (default — stored in the DB and
 * viewable in Admin → Notifications) and SMTP (Mailpit locally, or any SMTP
 * relay). Add SES/Postmark/Resend adapters by implementing this interface.
 */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<DeliveryResult>;
}
