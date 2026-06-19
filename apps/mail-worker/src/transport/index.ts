import type { AppConfig } from '@quiz/config';
import type { MailTransport } from './types';
import { ResendTransport } from './resend.transport';

export type { MailTransport, OutgoingEmail } from './types';

/**
 * Builds the configured mail transport. Throws at startup if the chosen provider
 * is missing required credentials — fail fast rather than discover it per-message.
 */
export function makeTransport(config: AppConfig): MailTransport {
  switch (config.EMAIL_PROVIDER) {
    case 'resend': {
      if (!config.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
      }
      return new ResendTransport(config.RESEND_API_KEY, config.EMAIL_FROM);
    }
    default:
      throw new Error(`Unsupported EMAIL_PROVIDER: ${config.EMAIL_PROVIDER}`);
  }
}
