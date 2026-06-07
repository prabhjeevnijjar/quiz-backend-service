import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// ─── Health Check Handler ─────────────────────────────────────────────────────
// Exercises every infrastructure connection in a single HTTP call.
// Returns a per-system breakdown so you can tell *which* system is down.
//
// Usage:
//   curl http://localhost:3000/health | jq .
//
// Response shape:
//   {
//     "status": "healthy" | "degraded",
//     "uptime": 12.345,
//     "checks": {
//       "postgres_write": { "status": "ok", "latency_ms": 1.2, "detail": "..." },
//       "postgres_read":  { "status": "ok", "latency_ms": 0.8, "detail": "..." },
//       "redis":          { "status": "ok", "latency_ms": 0.3 },
//       "rabbitmq":       { "status": "ok", "detail": "..." }
//     }
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface CheckResult {
  status:      'ok' | 'error';
  latency_ms?: number;
  detail?:     string;
  error?:      string;
}

async function measure<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start  = performance.now();
  const result = await fn();
  return { result, ms: Math.round((performance.now() - start) * 100) / 100 };
}

export default async function healthRoutes(fastify: FastifyInstance) {

  // ── GET /health ────────────────────────────────────────────────────────────
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {

    const checks: Record<string, CheckResult> = {};

    // ── PostgreSQL Write Pool (Primary) ────────────────────────────────────
    try {
      const { result, ms } = await measure(async () => {
        const client = await fastify.db.write.connect();
        try {
          const res = await client.query(
            `SELECT current_database() AS db, pg_is_in_recovery() AS is_replica, inet_server_addr() AS host`
          );
          return res.rows[0];
        } finally {
          client.release();
        }
      });
      checks.postgres_write = {
        status:     'ok',
        latency_ms: ms,
        detail:     `db=${result.db} is_replica=${result.is_replica} host=${result.host}`,
      };
    } catch (err) {
      checks.postgres_write = { status: 'error', error: (err as Error).message };
    }

    // ── PostgreSQL Read Pool (Replica) ─────────────────────────────────────
    try {
      const { result, ms } = await measure(async () => {
        const client = await fastify.db.read.connect();
        try {
          const res = await client.query(
            `SELECT current_database() AS db, pg_is_in_recovery() AS is_replica, inet_server_addr() AS host`
          );
          return res.rows[0];
        } finally {
          client.release();
        }
      });
      checks.postgres_read = {
        status:     'ok',
        latency_ms: ms,
        detail:     `db=${result.db} is_replica=${result.is_replica} host=${result.host}`,
      };
    } catch (err) {
      checks.postgres_read = { status: 'error', error: (err as Error).message };
    }

    // ── Redis ──────────────────────────────────────────────────────────────
    try {
      const { result, ms } = await measure(() => fastify.redis.ping());
      checks.redis = {
        status:     result === 'PONG' ? 'ok' : 'error',
        latency_ms: ms,
      };
    } catch (err) {
      checks.redis = { status: 'error', error: (err as Error).message };
    }

    // ── RabbitMQ ───────────────────────────────────────────────────────────
    // We check that the confirm channel can assert a known exchange without error.
    // assertExchange is idempotent — this is a no-op if topology hasn't changed.
    try {
      const { ms } = await measure(async () => {
        await fastify.amqp.channel.checkExchange('quiz.submissions');
      });
      checks.rabbitmq = {
        status:     'ok',
        latency_ms: ms,
        detail:     'channel open, exchange quiz.submissions exists',
      };
    } catch (err) {
      checks.rabbitmq = { status: 'error', error: (err as Error).message };
    }

    // ── Aggregate status ───────────────────────────────────────────────────
    const allOk    = Object.values(checks).every((c) => c.status === 'ok');
    const status   = allOk ? 'healthy' : 'degraded';
    const httpCode = allOk ? 200 : 503;

    return reply.status(httpCode).send({
      status,
      uptime_seconds: Math.round(process.uptime() * 1000) / 1000,
      timestamp:      new Date().toISOString(),
      checks,
    });
  });

  // ── POST /health/test-roundtrip ──────────────────────────────────────────
  // Full integration smoke test:
  //   1. Write a row to PostgreSQL (write pool)
  //   2. Read it back (read pool — same host in dev)
  //   3. SET + GET a key in Redis
  //   4. Publish + drain a message on RabbitMQ
  //   5. Clean up all test data
  // ────────────────────────────────────────────────────────────────────────
  fastify.post('/health/test-roundtrip', async (_req: FastifyRequest, reply: FastifyReply) => {

    const results: Record<string, CheckResult> = {};
    const testId = `health_${Date.now()}`;

    // 1. PostgreSQL write → read roundtrip
    try {
      const { ms } = await measure(async () => {
        // Ensure a test table exists
        await fastify.db.write.query(`
          CREATE TABLE IF NOT EXISTS _health_check (
            id    TEXT PRIMARY KEY,
            ts    TIMESTAMPTZ DEFAULT NOW()
          )
        `);
        // Write via write pool
        await fastify.db.write.query(
          'INSERT INTO _health_check (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
          [testId],
        );
        // Read via read pool (same host in dev, replica in prod)
        const res = await fastify.db.read.query(
          'SELECT id FROM _health_check WHERE id = $1',
          [testId],
        );
        if (res.rows.length === 0) throw new Error('Write succeeded but read returned 0 rows');
        // Cleanup
        await fastify.db.write.query('DELETE FROM _health_check WHERE id = $1', [testId]);
      });
      results.postgres_roundtrip = { status: 'ok', latency_ms: ms, detail: `wrote + read + deleted key=${testId}` };
    } catch (err) {
      results.postgres_roundtrip = { status: 'error', error: (err as Error).message };
    }

    // 2. Redis SET → GET roundtrip
    try {
      const redisKey = `_health:${testId}`;
      const { ms } = await measure(async () => {
        await fastify.redis.set(redisKey, 'alive', 'EX', 10);
        const val = await fastify.redis.get(redisKey);
        if (val !== 'alive') throw new Error(`Expected 'alive', got '${val}'`);
        await fastify.redis.del(redisKey);
      });
      results.redis_roundtrip = { status: 'ok', latency_ms: ms };
    } catch (err) {
      results.redis_roundtrip = { status: 'error', error: (err as Error).message };
    }

    // 3. RabbitMQ publish + consume roundtrip
    try {
      const { ms } = await measure(async () => {
        const testQueue   = `_health.test.${testId}`;
        const testPayload = JSON.stringify({ test: testId });

        // Assert a temporary queue (auto-delete after test)
        await fastify.amqp.channel.assertQueue(testQueue, {
          durable:    false,
          autoDelete: true,
          exclusive:  true,
        });

        // Publish with publisher confirms
        await new Promise<void>((resolve, reject) => {
          fastify.amqp.channel.sendToQueue(
            testQueue,
            Buffer.from(testPayload),
            { persistent: false },
            (err) => (err ? reject(err) : resolve()),
          );
        });

        // Consume one message with a 5 s timeout
        const consumed = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timed out waiting for RabbitMQ message')), 5_000);
          void fastify.amqp.channel.consume(testQueue, (msg) => {
            clearTimeout(timeout);
            if (msg) {
              fastify.amqp.channel.ack(msg);
              resolve(msg.content.toString());
            } else {
              reject(new Error('Consumer cancelled'));
            }
          }, { noAck: false });
        });

        if (consumed !== testPayload) throw new Error(`Payload mismatch: ${consumed}`);

        // Delete test queue
        await fastify.amqp.channel.deleteQueue(testQueue);
      });
      results.rabbitmq_roundtrip = { status: 'ok', latency_ms: ms, detail: 'publish → consume → ack → delete' };
    } catch (err) {
      results.rabbitmq_roundtrip = { status: 'error', error: (err as Error).message };
    }

    // ── Response ─────────────────────────────────────────────────────────────
    const allOk    = Object.values(results).every((c) => c.status === 'ok');
    const httpCode = allOk ? 200 : 503;

    return reply.status(httpCode).send({
      status:    allOk ? 'all_passed' : 'some_failed',
      test_id:   testId,
      timestamp: new Date().toISOString(),
      results,
    });
  });
}
