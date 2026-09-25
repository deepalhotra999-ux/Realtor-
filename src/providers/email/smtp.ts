import nodemailer, { type Transporter } from "nodemailer";
import type { DeliveryResult, EmailMessage, EmailProvider } from "./types";

export interface SmtpOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

/** Plain SMTP via nodemailer. Mailpit (docker-compose) gives a free local inbox UI. */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private readonly transport: Transporter;

  constructor(private readonly opts: SmtpOptions) {
    this.transport = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.port === 465,
      auth: opts.user ? { user: opts.user, pass: opts.password } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<DeliveryResult> {
    try {
      const info = await this.transport.sendMail({
        from: this.opts.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
      });
      return { status: "sent", providerRef: info.messageId };
    } catch (err) {
      return { status: "failed", error: (err as Error).message };
    }
  }
}
