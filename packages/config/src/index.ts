import { z } from 'zod';

// ─── Environment Schema ──────────────────────────────────────────────────────
// All env vars are validated at startup. If any required var is missing,
// the process exits with a clear error listing every missing field.
// ─────────────────────────────────────────────────────────────────────────────

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT:     z.coerce.number().default(3000),
  HOST:     z.string().default('0.0.0.0'),

  // ── PostgreSQL ─────────────────────────────────────────────────────────────
  // Two separate hosts: one for writes (primary) and one for reads (replica).
  // This is enforced at the pool level — the application never decides
  // at query time; the correct pool is selected by convention in the repo layer.
  PG_WRITE_HOST:     z.string().min(1, 'PG_WRITE_HOST is required'),
  PG_READ_HOST:      z.string().min(1, 'PG_READ_HOST is required'),
  PG_PORT:           z.coerce.number().default(5432),
  PG_DATABASE:       z.string().min(1, 'PG_DATABASE is required'),
  PG_USER:           z.string().min(1, 'PG_USER is required'),
  PG_PASSWORD:       z.string().min(1, 'PG_PASSWORD is required'),
  // Write pool intentionally smaller — writes are more expensive than reads
  PG_WRITE_POOL_MAX: z.coerce.number().default(20),
  // Read pool larger — supports high-fan-out leaderboard/analytics queries
  PG_READ_POOL_MAX:  z.coerce.number().default(40),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_HOST:     z.string().min(1, 'REDIS_HOST is required'),
  REDIS_PORT:     z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // ── RabbitMQ ───────────────────────────────────────────────────────────────
  RABBITMQ_URL: z.string().url('RABBITMQ_URL must be a valid amqp:// URL'),

  // ── JWT ────────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(): AppConfig {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    console.error('\n❌  Invalid / missing environment variables:\n');
    for (const [field, messages] of Object.entries(errors)) {
      console.error(`    ${field}: ${(messages ?? []).join(', ')}`);
    }
    console.error('\n    Copy .env.example → .env and fill in the blanks.\n');
    process.exit(1);
  }

  return result.data;
}
