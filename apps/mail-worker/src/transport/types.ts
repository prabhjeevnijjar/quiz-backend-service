export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Provider-agnostic mail transport. The worker depends only on this interface;
 * swapping Resend for SES/SendGrid means adding another implementation, nothing else.
 * Implementations MUST throw on a failed send so the consumer can nack/retry.
 */
export interface MailTransport {
  send(email: OutgoingEmail): Promise<void>;
}
