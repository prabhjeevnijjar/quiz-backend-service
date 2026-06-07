import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '@quiz/config';

// ─── Type augmentation ────────────────────────────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

interface RedisPluginOptions {
  config: AppConfig;
}

const redisPlugin: FastifyPluginAsync<RedisPluginOptions> = async (fastify, { config }) => {

  const redis = new Redis({
    host:                  config.REDIS_HOST,
    port:                  config.REDIS_PORT,
    password:              config.REDIS_PASSWORD,
    maxRetriesPerRequest:  3,
    enableReadyCheck:      true,
    lazyConnect:           false,
    // Reconnect on network errors and failovers — NOT on auth errors
    reconnectOnError: (err) => {
      const retryOn = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
      return retryOn.some((msg) => err.message.includes(msg));
    },
    retryStrategy: (times) => {
      if (times > 10) return null; // give up after 10 retries
      return Math.min(times * 200, 3000); // exponential backoff, max 3s
    },
  });

  // ── Startup verification ───────────────────────────────────────────────────
  const pong = await redis.ping();
  if (pong !== 'PONG') throw new Error('Redis PING did not return PONG');
  fastify.log.info(`✅  Redis connected — host: ${config.REDIS_HOST}:${config.REDIS_PORT}`);

  // ── Decorate ───────────────────────────────────────────────────────────────
  fastify.decorate('redis', redis);

  // ── Event listeners ────────────────────────────────────────────────────────
  redis.on('error',        (err) => fastify.log.error({ err }, 'Redis error'));
  redis.on('reconnecting', ()    => fastify.log.warn('Redis reconnecting...'));
  redis.on('ready',        ()    => fastify.log.info('Redis ready'));

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing Redis connection...');
    await redis.quit();
  });
};

export default fp(redisPlugin, { name: 'redis' });
