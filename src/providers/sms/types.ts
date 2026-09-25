import type { DeliveryResult } from "@/providers/email/types";

export interface SmsMessage {
  to: string;
  body: string;
}

/**
 * Outbound SMS. Only a local outbox ships (SMS gateways are paid). Add a
 * Twilio/Vonage/self-hosted-gateway adapter by implementing this interface.
 */
export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<DeliveryResult>;
}

export class OutboxSmsProvider implements SmsProvider {
  readonly name = "outbox";

  async send(message: SmsMessage): Promise<DeliveryResult> {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[sms:outbox] → ${message.to} · ${message.body.slice(0, 60)}`);
    }
    return { status: "sent", providerRef: `sms-outbox-${Date.now().toString(36)}` };
  }
}
