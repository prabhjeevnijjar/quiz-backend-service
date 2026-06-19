import dotenv from 'dotenv';
import amqplib from 'amqplib';
import { loadConfig } from '@quiz/config';
import { logger } from '@quiz/logger';
import { assertTopology, QUEUE_NAMES } from '@quiz/messaging';
import { makeTransport } from './transport';
import { makeInviteConsumer, makeEmailConsumer } from './handlers';

async function main(): Promise<void> {
  dotenv.config({
    path: process.env.NODE_ENV === 'production' ? '.env' : '.env.dev',
  });
  const config = loadConfig();

  if (!config.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL is required to start the mail-worker');
  }

  // Fail fast if the provider is misconfigured, before we start consuming.
  const transport = makeTransport(config);
  logger.info(`mail-worker using email provider: ${config.EMAIL_PROVIDER}`);

  const connection = await amqplib.connect(config.RABBITMQ_URL);
  logger.info(`✅  RabbitMQ connected — ${config.RABBITMQ_URL}`);

  const channel = await connection.createChannel();
  await assertTopology(channel);
  await channel.prefetch(config.EMAIL_PREFETCH);

  const deps = { channel, transport, logger };

  await channel.consume(
    QUEUE_NAMES.INVITES_DISPATCH,
    makeInviteConsumer(deps)(QUEUE_NAMES.INVITES_DISPATCH),
    { noAck: false },
  );
  await channel.consume(
    QUEUE_NAMES.EMAILS_DISPATCH,
    makeEmailConsumer(deps)(QUEUE_NAMES.EMAILS_DISPATCH),
    { noAck: false },
  );

  logger.info(
    `mail-worker consuming [${QUEUE_NAMES.INVITES_DISPATCH}, ${QUEUE_NAMES.EMAILS_DISPATCH}] (prefetch=${config.EMAIL_PREFETCH})`,
  );

  let shuttingDown = false;

  connection.on('error', (err: Error) => logger.error({ err }, 'RabbitMQ connection error'));
  connection.on('close', () => {
    if (shuttingDown) return;
    // The worker is a pure consumer with no healthcheck; a dead connection means it
    // silently stops processing. Exit non-zero so the container restart policy recovers
    // it (re-asserting topology and re-consuming) rather than idling forever.
    logger.error('RabbitMQ connection closed unexpectedly — exiting for restart');
    process.exit(1);
  });

  const shutdown = async (signal: string): Promise<void> => {
    shuttingDown = true;
    logger.info(`Received ${signal}. Shutting down mail-worker gracefully...`);
    try {
      await channel.close();
      await connection.close();
    } catch {
      // Ignore errors during shutdown — connection may already be gone
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start mail-worker');
  process.exit(1);
});
