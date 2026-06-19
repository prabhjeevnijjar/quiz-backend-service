import type { Channel, Options } from 'amqplib';

// ─── Broker topology ──────────────────────────────────────────────────────────
// Single source of truth for exchanges, queues and bindings, shared by every
// service that talks to RabbitMQ (api-gateway producer, mail-worker consumer, …).
// assertExchange / assertQueue are idempotent — safe to call from each service on
// startup AS LONG AS the arguments here never diverge between callers. That is the
// whole reason this lives in one package instead of being copied per service.
// ─────────────────────────────────────────────────────────────────────────────

export const EXCHANGE_NAMES = {
  SUBMISSIONS: 'quiz.submissions',
  EMAILS:      'quiz.emails',
  INVITES:     'quiz.invites',
  LIFECYCLE:   'quiz.lifecycle',
  DLX:         'dlx',
} as const;

export const QUEUE_NAMES = {
  SUBMISSIONS_SCORING: 'quiz.submissions.scoring',
  EMAILS_DISPATCH:     'quiz.emails.dispatch',
  INVITES_DISPATCH:    'quiz.invites.dispatch',
  DLQ_SUBMISSIONS:     'dlq.submissions',
  DLQ_EMAILS:          'dlq.emails',
  DLQ_INVITES:         'dlq.invites',
} as const;

// Direct exchanges quiz.emails / quiz.invites bind their dispatch queue with the
// empty routing key — publishers must use the same key to reach the queue.
export const INVITES_ROUTING_KEY = '';
export const EMAILS_ROUTING_KEY = '';

interface ExchangeDef {
  name: string;
  type: 'direct' | 'topic' | 'fanout';
  durable: boolean;
}

interface QueueDef {
  name: string;
  bindTo: string;
  routingKey: string;
  options: Options.AssertQueue;
}

export const EXCHANGES: ExchangeDef[] = [
  { name: EXCHANGE_NAMES.SUBMISSIONS, type: 'topic',  durable: true },
  { name: EXCHANGE_NAMES.EMAILS,      type: 'direct', durable: true },
  { name: EXCHANGE_NAMES.INVITES,     type: 'direct', durable: true },
  { name: EXCHANGE_NAMES.LIFECYCLE,   type: 'fanout', durable: true },
  // Dead-letter exchange — all queues route failures here
  { name: EXCHANGE_NAMES.DLX,         type: 'direct', durable: true },
];

export const QUEUES: QueueDef[] = [
  // ── Primary queues (quorum) ──────────────────────────────────────────────
  {
    name:       QUEUE_NAMES.SUBMISSIONS_SCORING,
    bindTo:     EXCHANGE_NAMES.SUBMISSIONS,
    routingKey: 'submission.received',
    options: {
      durable: true,
      arguments: {
        'x-queue-type':              'quorum',     // Raft-based, no data loss
        'x-dead-letter-exchange':    EXCHANGE_NAMES.DLX,
        'x-dead-letter-routing-key': QUEUE_NAMES.DLQ_SUBMISSIONS,
        'x-delivery-limit':          3,            // max 3 delivery attempts
      },
    },
  },
  {
    name:       QUEUE_NAMES.EMAILS_DISPATCH,
    bindTo:     EXCHANGE_NAMES.EMAILS,
    routingKey: EMAILS_ROUTING_KEY,
    options: {
      durable: true,
      arguments: {
        'x-queue-type':              'quorum',
        'x-dead-letter-exchange':    EXCHANGE_NAMES.DLX,
        'x-dead-letter-routing-key': QUEUE_NAMES.DLQ_EMAILS,
        'x-delivery-limit':          5,            // emails get more retries
      },
    },
  },
  {
    name:       QUEUE_NAMES.INVITES_DISPATCH,
    bindTo:     EXCHANGE_NAMES.INVITES,
    routingKey: INVITES_ROUTING_KEY,
    options: {
      durable: true,
      arguments: {
        'x-queue-type':              'quorum',
        'x-dead-letter-exchange':    EXCHANGE_NAMES.DLX,
        'x-dead-letter-routing-key': QUEUE_NAMES.DLQ_INVITES,
        'x-delivery-limit':          5,
      },
    },
  },
  // ── Dead-letter queues (quorum) ──────────────────────────────────────────
  // Messages land here after max retries. Alerting + manual replay source.
  {
    name:       QUEUE_NAMES.DLQ_SUBMISSIONS,
    bindTo:     EXCHANGE_NAMES.DLX,
    routingKey: QUEUE_NAMES.DLQ_SUBMISSIONS,
    options: { durable: true, arguments: { 'x-queue-type': 'quorum' } },
  },
  {
    name:       QUEUE_NAMES.DLQ_EMAILS,
    bindTo:     EXCHANGE_NAMES.DLX,
    routingKey: QUEUE_NAMES.DLQ_EMAILS,
    options: { durable: true, arguments: { 'x-queue-type': 'quorum' } },
  },
  {
    name:       QUEUE_NAMES.DLQ_INVITES,
    bindTo:     EXCHANGE_NAMES.DLX,
    routingKey: QUEUE_NAMES.DLQ_INVITES,
    options: { durable: true, arguments: { 'x-queue-type': 'quorum' } },
  },
];

/**
 * Idempotently asserts the full exchange/queue/binding topology on a channel.
 * Call once at startup in every service. assertExchange/assertQueue/bindQueue
 * are no-ops when the topology already exists with identical arguments.
 */
export async function assertTopology(channel: Channel): Promise<void> {
  for (const ex of EXCHANGES) {
    await channel.assertExchange(ex.name, ex.type, { durable: ex.durable });
  }
  for (const q of QUEUES) {
    await channel.assertQueue(q.name, q.options);
    await channel.bindQueue(q.name, q.bindTo, q.routingKey);
  }
}
