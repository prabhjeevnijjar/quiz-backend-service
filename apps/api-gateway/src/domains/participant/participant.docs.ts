import type { FastifySchema } from 'fastify';
import * as schemas from './participant.schemas';

/**
 * OpenAPI / Swagger documentation for the participant routes.
 *
 * Mirrors the admin pattern (see ../admin/admin.docs.ts): kept separate from
 * ./participant.routes.ts so the handlers stay focused on logic. Consumed as
 * `{ schema: participantDocs.<key> }` in each route definition.
 *
 * Routes after the OTP step carry `security: [{ bearerAuth: [] }]` and are
 * enforced at runtime by the `authenticate(['participant'])` preHandler.
 */
export const participantDocs = {
  join: {
    description: 'Join a quiz via its public link. Sends a one-time password (OTP) to the participant email.',
    tags: ['Participant'],
    params: schemas.quizSlugParamsSchema,
    body: schemas.joinBodySchema,
    response: {
      202: schemas.joinResponse202Schema,
      400: schemas.errorResponseSchema,
      404: schemas.errorResponseSchema,
    },
  },
  verifyOtp: {
    description: 'Verify the emailed OTP and receive a participant JWT.',
    tags: ['Participant'],
    params: schemas.quizSlugParamsSchema,
    body: schemas.verifyOtpBodySchema,
    response: {
      200: schemas.verifyOtpResponse200Schema,
      400: schemas.errorResponseSchema,
      401: schemas.errorResponseSchema,
    },
  },
  waitingRoom: {
    description: 'Enter the waiting room before the quiz starts (registers presence in Redis).',
    tags: ['Participant'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizSlugParamsSchema,
    response: {
      200: schemas.waitingRoomResponse200Schema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  questions: {
    description: 'Fetch the quiz questions. Only available while the quiz is Live.',
    tags: ['Participant'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizSlugParamsSchema,
    response: {
      200: schemas.getQuestionsResponse200Schema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  submit: {
    description: 'Submit answers. Accepted asynchronously via the Transactional Outbox pattern.',
    tags: ['Participant'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizSlugParamsSchema,
    body: schemas.submitBodySchema,
    response: {
      202: schemas.submitResponse202Schema,
      400: schemas.errorResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  leaderboard: {
    description: 'Get an HTTP snapshot of the current leaderboard from Redis.',
    tags: ['Participant'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizSlugParamsSchema,
    response: {
      200: schemas.getLeaderboardResponse200Schema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
} satisfies Record<string, FastifySchema>;
