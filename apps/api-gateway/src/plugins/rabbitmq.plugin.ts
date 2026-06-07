import fp from 'fastify-plugin';
import amqplib from 'amqplib';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '@quiz/config';

// ─── Type augmentation ────────────────────────────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    amqp: {
      /** Persistent TCP connection — shared across the app */
      connection: amqplib.Connection;
      /**
       * ConfirmChannel — enables publisher confirms.
       * A message is only ACK'd by the broker once it is safely written
       * to the quorum queue on disk. Use this for all outbox publishes.
       */
      channel: amqplib.ConfirmChannel;
    };
  }
}

interface RabbitMQPluginOptions {
  config: AppConfig;
}

// ─── Exchange / Queue topology ────────────────────────────────────────────────
// Declared once at startup. assertExchange / assertQueue are idempotent —
// safe to call on every deploy as long as arguments don't change.
// ─────────────────────────────────────────────────────────────────────────────

const EXCHANGES = [
  { name: 'quiz.submissions', type: 'topic',   durable: true },
  { name: 'quiz.emails',      type: 'direct',  durable: true },
  { name: 'quiz.invites',     type: 'direct',  durable: true },
  { name: 'quiz.lifecycle',   type: 'fanout',  durable: true },
  // Dead-letter exchange — all queues route failures here
  { name: 'dlx',              type: 'direct',  durable: true },
] as const;

const QUEUES = [
  // ── Primary queues (quorum) ──────────────────────────────────────────────
  {
    name:       'quiz.submissions.scoring',
    bindTo:     'quiz.submissions',
    routingKey: 'submission.received',
    options: {
      durable: true,
      arguments: {
        'x-queue-type':              'quorum',     // Raft-based, no data loss
        'x-dead-letter-exchange':    'dlx',
        'x-dead-letter-routing-key': 'dlq.submissions',
        'x-delivery-limit':          3,            // max 3 delivery attempts
      },
    },
  },
  {
    name:       'quiz.emails.dispatch',
    bindTo:     'quiz.emails',
    routingKey: '',
    options: {
      durable: true,
      arguments: {
        'x-queue-type':              'quorum',
        'x-dead-letter-exchange':    'dlx',
        'x-dead-letter-routing-key': 'dlq.emails',
        'x-delivery-limit':          5,            // emails get more retries
      },
    },
  },
  {
    name:       'quiz.invites.dispatch',
    bindTo:     'quiz.invites',
    routingKey: '',
    options: {
      durable: true,
      arguments: {
        'x-queue-type':              'quorum',
        'x-dead-letter-exchange':    'dlx',
        'x-dead-letter-routing-key': 'dlq.invites',
        'x-delivery-limit':          5,
      },
    },
  },
  // ── Dead-letter queues (quorum) ──────────────────────────────────────────
  // Messages land here after max retries. Alerting + manual replay source.
  {
    name:       'dlq.submissions',
    bindTo:     'dlx',
    routingKey: 'dlq.submissions',
    options: { durable: true, arguments: { 'x-queue-type': 'quorum' } },
  },
  {
    name:       'dlq.emails',
    bindTo:     'dlx',
    routingKey: 'dlq.emails',
    options: { durable: true, arguments: { 'x-queue-type': 'quorum' } },
  },
  {
    name:       'dlq.invites',
    bindTo:     'dlx',
    routingKey: 'dlq.invites',
    options: { durable: true, arguments: { 'x-queue-type': 'quorum' } },
  },
] as const;

const rabbitmqPlugin: FastifyPluginAsync<RabbitMQPluginOptions> = async (fastify, { config }) => {

  // ── Connect ────────────────────────────────────────────────────────────────
  const connection = await amqplib.connect(config.RABBITMQ_URL) as amqplib.Connection;
  fastify.log.info(`✅  RabbitMQ connected — ${config.RABBITMQ_URL}`);

  // ── Create a ConfirmChannel (publisher confirms enabled) ───────────────────
  // prefetch(1) for the topology channel — we only assert, never consume here.
  const channel = await connection.createConfirmChannel();
  await channel.prefetch(1);

  // ── Assert exchanges ───────────────────────────────────────────────────────
  for (const ex of EXCHANGES) {
    await channel.assertExchange(ex.name, ex.type, { durable: ex.durable });
    fastify.log.info(`  ↳ Exchange: ${ex.name} (${ex.type})`);
  }

  // ── Assert queues + bindings ───────────────────────────────────────────────
  for (const q of QUEUES) {
    await channel.assertQueue(q.name, q.options);
    await channel.bindQueue(q.name, q.bindTo, q.routingKey);
    fastify.log.info(`  ↳ Queue: ${q.name} → [${q.bindTo}] key="${q.routingKey}"`);
  }

  // ── Decorate ───────────────────────────────────────────────────────────────
  fastify.decorate('amqp', { connection, channel });

  // ── Connection-level events ────────────────────────────────────────────────
  connection.on('error', (err: Error) =>
    fastify.log.error({ err }, 'RabbitMQ connection error'),
  );
  connection.on('close', () =>
    fastify.log.warn('RabbitMQ connection closed — consider a reconnect strategy'),
  );

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing RabbitMQ channel and connection...');
    try {
      await channel.close();
      await connection.close();
    } catch {
      // Ignore errors during shutdown — connection may already be gone
    }
  });
};

export default fp(rabbitmqPlugin, { name: 'rabbitmq' });
