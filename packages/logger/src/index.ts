import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // pino-pretty is used in non-production for human-readable output.
  // In production, raw JSON is emitted for structured log ingestion (Loki, etc.)
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize:      true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore:        'pid,hostname',
          },
        }
      : undefined,
});

export type Logger = typeof logger;
