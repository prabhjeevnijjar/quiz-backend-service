import type { Channel, ConsumeMessage } from 'amqplib';
import type { Logger } from '@quiz/logger';
import type { InviteEvent, EmailJob, OtpEmailData } from '@quiz/messaging';
import type { MailTransport } from './transport';
import { renderInvite, renderOtp } from './templates';

/**
 * Thrown for messages that can never succeed (malformed JSON, missing fields,
 * unknown template). These are nacked WITHOUT requeue → straight to the DLQ.
 * Any other error is treated as transient (e.g. provider outage) → requeued and
 * retried up to the queue's x-delivery-limit, then dead-lettered.
 */
export class PermanentMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentMessageError';
  }
}

function parseMessage<T>(msg: ConsumeMessage): T {
  try {
    return JSON.parse(msg.content.toString()) as T;
  } catch {
    throw new PermanentMessageError('message body is not valid JSON');
  }
}

/** Builds the invite email from a quiz.invites.dispatch message and sends it. */
async function handleInvite(msg: ConsumeMessage, transport: MailTransport): Promise<void> {
  const event = parseMessage<InviteEvent>(msg);
  if (!event?.to || !event.joinLink || !event.quizTitle) {
    throw new PermanentMessageError('invite event missing required fields (to/joinLink/quizTitle)');
  }
  await transport.send(renderInvite(event));
}

/** Builds and sends an email from a generic quiz.emails.dispatch job (OTP, …). */
async function handleEmailJob(msg: ConsumeMessage, transport: MailTransport): Promise<void> {
  const job = parseMessage<EmailJob>(msg);
  if (!job?.to || !job.template) {
    throw new PermanentMessageError('email job missing required fields (to/template)');
  }

  switch (job.template) {
    case 'otp': {
      const data = job.data as unknown as OtpEmailData | undefined;
      if (!data?.code) throw new PermanentMessageError('otp email job missing data.code');
      await transport.send(renderOtp(job.to, data));
      return;
    }
    default:
      throw new PermanentMessageError(`unknown email template: ${String(job.template)}`);
  }
}

type MessageHandler = (msg: ConsumeMessage, transport: MailTransport) => Promise<void>;

/**
 * Wraps a per-message handler into an amqplib consume callback with ack/nack and
 * permanent-vs-transient routing. The channel is shared, so handlers must be safe
 * to run concurrently (they are — each only touches its own message).
 */
function makeConsumer(
  queue: string,
  handle: MessageHandler,
  deps: { channel: Channel; transport: MailTransport; logger: Logger },
) {
  const { channel, transport, logger } = deps;
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) {
      logger.warn({ queue }, 'consumer cancelled by broker');
      return;
    }
    try {
      await handle(msg, transport);
      channel.ack(msg);
    } catch (err) {
      const permanent = err instanceof PermanentMessageError;
      logger.error(
        { err, queue, permanent, redelivered: msg.fields.redelivered },
        permanent ? 'email message rejected (poison → DLQ)' : 'email send failed (will retry → DLQ on limit)',
      );
      // permanent → no requeue (straight to DLQ); transient → requeue (capped by x-delivery-limit)
      channel.nack(msg, false, !permanent);
    }
  };
}

export function makeInviteConsumer(deps: { channel: Channel; transport: MailTransport; logger: Logger }) {
  return (queue: string) => makeConsumer(queue, handleInvite, deps);
}

export function makeEmailConsumer(deps: { channel: Channel; transport: MailTransport; logger: Logger }) {
  return (queue: string) => makeConsumer(queue, handleEmailJob, deps);
}
