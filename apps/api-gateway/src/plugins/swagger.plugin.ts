import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import type { FastifyPluginAsync } from 'fastify';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Register the OpenAPI document generator
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Quiz Platform API Documentation',
        description: 'Comprehensive API endpoints reference for both Quiz Administrators and Participants.',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development Server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Provide your administrator or participant authentication JWT token.',
          },
        },
      },
    },
    // Auto-transform Zod schemas to Standard OpenAPI JSON schemas
    transform: jsonSchemaTransform,
  });

  // Register the Swagger UI interface
  await fastify.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list', // Collapse listings by default
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
};

export default fp(swaggerPlugin, { name: 'swagger' });
