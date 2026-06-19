import fp from 'fastify-plugin';
import amqplib from 'amqplib';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '@quiz/config';
import { assertTopology } from '@quiz/messaging';

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

const rabbitmqPlugin: FastifyPluginAsync<RabbitMQPluginOptions> = async (fastify, { config }) => {

  // ── Connect ────────────────────────────────────────────────────────────────
  const connection = await amqplib.connect(config.RABBITMQ_URL) as amqplib.Connection;
  fastify.log.info(`✅  RabbitMQ connected — ${config.RABBITMQ_URL}`);

  // ── Create a ConfirmChannel (publisher confirms enabled) ───────────────────
  // prefetch(1) for the topology channel — we only assert, never consume here.
  const channel = await connection.createConfirmChannel();
  await channel.prefetch(1);

  // ── Assert shared exchange/queue topology (see @quiz/messaging) ─────────────
  await assertTopology(channel);
  fastify.log.info('  ↳ RabbitMQ topology asserted (exchanges, queues, bindings)');

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
