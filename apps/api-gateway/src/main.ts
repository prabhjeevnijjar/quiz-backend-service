import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { loadConfig } from "@quiz/config";
import { logger } from "@quiz/logger";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";

import dbPlugin from "./plugins/db.plugin";
import redisPlugin from "./plugins/redis.plugin";
import rabbitmqPlugin from "./plugins/rabbitmq.plugin";
import swaggerPlugin from "./plugins/swagger.plugin";

import healthRoutes from './domains/health/health.handler';
import adminRoutes from './domains/admin/admin.routes';
import participantRoutes from './domains/participant/participant.routes';

const HTTP_STATUS_LABELS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

async function main() {
  dotenv.config({
    path: process.env.NODE_ENV === "production" ? ".env" : ".env.dev", // for dev/localhost  use the .env.dev file for docker compose use .env.example
  });
  const config = loadConfig();

  const app = Fastify({
    logger,
    // Disable request-id generation overhead if behind a load balancer
    // that already supplies X-Request-Id
    requestIdHeader: "x-request-id",
    trustProxy: true,
  });

  // Enable Zod type-safe validators & serializers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // CORS
  await app.register(cors, { origin: true });

  // Infrastructuree
  await app.register(dbPlugin, { config });
  await app.register(redisPlugin, { config });
  await app.register(rabbitmqPlugin, { config });
  await app.register(swaggerPlugin);

  app.setErrorHandler((err, _request, reply) => {
    const statusCode = err.statusCode ?? 500;
    app.log.error({ err, statusCode }, err.message);
    reply.status(statusCode).send({
      statusCode,
      error: HTTP_STATUS_LABELS[statusCode] ?? 'Internal Server Error',
      message: statusCode >= 500 ? 'An unexpected error occurred' : err.message,
    });
  });

  // api route handlers
  await app.register(healthRoutes);
  await app.register(adminRoutes);
  await app.register(participantRoutes);

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(
    `api-gateway listening on http://${config.HOST}:${config.PORT}`,
  );

  // shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start api-gateway");
  process.exit(1);
});
