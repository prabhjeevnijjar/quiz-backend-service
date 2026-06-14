import fp from 'fastify-plugin';
import { Pool, PoolConfig } from 'pg';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '@quiz/config';

// ─── Type augmentation ────────────────────────────────────────────────────────
// Exposes fastify.db.write and fastify.db.read throughout the whole app.
// Convention enforced here:
//   fastify.db.write  → postgres-primary  (INSERT / UPDATE / DELETE)
//   fastify.db.read   → postgres-replica  (SELECT)
// Never mix them. Repositories must choose explicitly.
// ─────────────────────────────────────────────────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    db: {
      /** Points to PostgreSQL PRIMARY — use only for writes */
      write: Pool;
      /** Points to PostgreSQL READ REPLICA — use only for reads */
      read: Pool;
    };
  }
}





interface DbPluginOptions {
  config: AppConfig;
}

// Shared pool settings applied to both pools
const BASE_POOL: Partial<PoolConfig> = {
  port:                   5432,
  idleTimeoutMillis:      30_000,   // release idle connections after 30s
  connectionTimeoutMillis: 5_000,   // fail fast if primary is unreachable
  allowExitOnIdle:        false,    // keep pool alive even with no activity
};

const dbPlugin: FastifyPluginAsync<DbPluginOptions> = async (fastify, { config }) => {

  // ── Write Pool → Primary ───────────────────────────────────────────────────
  const writePool = new Pool({
    ...BASE_POOL,
    host:             config.PG_WRITE_HOST,
    port:             config.PG_PORT,
    database:         config.PG_DATABASE,
    user:             config.PG_USER,
    password:         config.PG_PASSWORD,
    max:              config.PG_WRITE_POOL_MAX,
    application_name: 'quiz-api-write',   // visible in pg_stat_activity
  });

  // ── Read Pool → Replica ────────────────────────────────────────────────────
  const readPool = new Pool({
    ...BASE_POOL,
    host:             config.PG_READ_HOST,
    port:             config.PG_PORT,
    database:         config.PG_DATABASE,
    user:             config.PG_USER,
    password:         config.PG_PASSWORD,
    max:              config.PG_READ_POOL_MAX,
    application_name: 'quiz-api-read',    // visible in pg_stat_activity
  });

  // ── Startup connection verification ───────────────────────────────────────
  // Fail loud and early. A bad DB config should crash startup, not hide in logs.
  const verifyPool = async (pool: Pool, label: string) => {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      fastify.log.info(`PostgreSQL [${label}] connected to host: ${
        label === 'write' ? config.PG_WRITE_HOST : config.PG_READ_HOST
      }, pool max: ${pool.options.max}`);
    } finally {
      client.release();
    }
  };

  await verifyPool(writePool, 'write');
  await verifyPool(readPool,  'read');

  fastify.decorate('db', { write: writePool, read: readPool });

  writePool.on('error', (err) => fastify.log.error({ err }, 'Write pool idle client error'));
  readPool.on('error',  (err) => fastify.log.error({ err }, 'Read pool idle client error'));

  fastify.addHook('onClose', async () => {
    fastify.log.info('Draining PostgreSQL pools...');
    await Promise.all([writePool.end(), readPool.end()]);
  });
};

export default fp(dbPlugin, { name: 'db' });
