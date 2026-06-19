import { Resend } from 'resend';
import type { MailTransport, OutgoingEmail } from './types';

/**
 * Resend-backed transport. Note: resend.emails.send() resolves with { data, error }
 * and does NOT throw on a provider-side failure — we surface `error` as a thrown
 * Error so the consumer treats it as a failed delivery (nack → retry → DLQ).
 */
export class ResendTransport implements MailTransport {
  private readonly client: Resend;

  constructor(apiKey: string, private readonly from: string) {
    this.client = new Resend(apiKey);
  }

  async send(email: OutgoingEmail): Promise<void> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
    }
    if (!data) {
      throw new Error('Resend send returned neither data nor error');
    }
  }
}
