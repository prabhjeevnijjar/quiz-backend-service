export type AppConfig = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  HOST: string;
  /** Public base URL participants use to reach the app, e.g. https://quiz.example.com */
  PUBLIC_BASE_URL: string;

  PG_WRITE_HOST?: string;
  PG_READ_HOST?: string;
  PG_PORT: number;
  PG_DATABASE?: string;
  PG_USER?: string;
  PG_PASSWORD?: string;
  PG_WRITE_POOL_MAX: number;
  PG_READ_POOL_MAX: number;

  REDIS_HOST?: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;

  RABBITMQ_URL?: string;
  JWT_SECRET?: string;
};

export function loadConfig(): AppConfig {
  return {
    NODE_ENV: (process.env.NODE_ENV as AppConfig['NODE_ENV']) ?? 'development',
    PORT: Number(process.env.PORT ?? 3000),
    HOST: process.env.HOST ?? '0.0.0.0',
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',

    PG_WRITE_HOST: process.env.PG_WRITE_HOST,
    PG_READ_HOST: process.env.PG_READ_HOST,
    PG_PORT: Number(process.env.PG_PORT ?? 5432),
    PG_DATABASE: process.env.PG_DATABASE,
    PG_USER: process.env.PG_USER,
    PG_PASSWORD: process.env.PG_PASSWORD,
    PG_WRITE_POOL_MAX: Number(process.env.PG_WRITE_POOL_MAX ?? 20),
    PG_READ_POOL_MAX: Number(process.env.PG_READ_POOL_MAX ?? 40),

    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    RABBITMQ_URL: process.env.RABBITMQ_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  };
}