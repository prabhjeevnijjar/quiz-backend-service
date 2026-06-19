// ─── Message contracts ────────────────────────────────────────────────────────
// Shared payload shapes for messages flowing over the broker. Producers (api-gateway)
// and consumers (mail-worker) both import these so the wire format stays in lockstep.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Published to the `quiz.invites` exchange by the admin invites endpoint.
 * Consumed from `quiz.invites.dispatch` by the mail-worker to send the invite email.
 */
export interface InviteEvent {
  to: string;
  name: string;
  quizId: string;
  quizTitle: string;
  joinLink: string;
  startTime: string;
}

/** Templates the generic email lane (`quiz.emails`) knows how to render. */
export type EmailTemplate = 'otp';

/**
 * Generic "send this email" job published to the `quiz.emails` exchange and consumed
 * from `quiz.emails.dispatch`. Reusable for OTPs and any future transactional email.
 */
export interface EmailJob {
  template: EmailTemplate;
  to: string;
  data: Record<string, unknown>;
}

/** `data` shape for an EmailJob with template === 'otp'. */
export interface OtpEmailData {
  code: string;
  quizTitle?: string;
  expiresInMinutes?: number;
}
