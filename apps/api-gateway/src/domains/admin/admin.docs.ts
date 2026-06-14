import type { FastifySchema } from 'fastify';
import * as schemas from './admin.schemas';

/**
 * OpenAPI / Swagger documentation for the admin routes.
 *
 * Kept separate from ./admin.routes.ts so the handlers stay focused on logic.
 * Each entry is consumed as `{ schema: adminDocs.<key> }` in the route definition.
 *
 * NOTE: this object is a plain `const` checked with `satisfies` — it is never
 * annotated with a widening type (e.g. `: FastifySchema`). That preserves the
 * precise Zod types of `body`/`params`, which is what lets the ZodTypeProvider
 * infer `request.body` / `request.params` back in the route handlers.
 */
export const adminDocs = {
  // ─── Authentication ─────────────────────────────────────────────────────────
  login: {
    description: 'Log in as an administrator to receive access and refresh tokens.',
    tags: ['Admin Auth'],
    body: schemas.loginBodySchema,
    response: {
      200: schemas.loginResponse200Schema,
      400: schemas.errorResponseSchema,
      401: schemas.errorResponseSchema,
    },
  },
  refresh: {
    description: 'Refresh the access token using a valid refresh token with rotation.',
    tags: ['Admin Auth'],
    body: schemas.refreshBodySchema,
    response: {
      200: schemas.refreshResponse200Schema,
      400: schemas.errorResponseSchema,
      401: schemas.errorResponseSchema,
    },
  },
  logout: {
    description: 'Log out the administrator, revoking their refresh token family in Redis.',
    tags: ['Admin Auth'],
    body: schemas.logoutBodySchema,
    response: {
      200: schemas.logoutResponse200Schema,
      400: schemas.errorResponseSchema,
    },
  },

  // ─── Admin Users ──────────────────────────────────────────────────────────
  createAdmin: {
    description: 'Register a new administrator.',
    tags: ['Admin Users'],
    security: [{ bearerAuth: [] }],
    body: schemas.createAdminBodySchema,
    response: {
      201: schemas.createAdminResponse201Schema,
      400: schemas.errorResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },

  // ─── Quiz Management ────────────────────────────────────────────────────────
  createQuiz: {
    description: 'Create a new quiz draft.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    response: {
      201: schemas.simpleSuccessMessageSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  listQuizzes: {
    description: 'List all quizzes with pagination.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    response: {
      200: schemas.getQuizzesResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  getQuiz: {
    description: 'Get quiz details including questions and schedule.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdParamsSchema,
    response: {
      200: schemas.getQuizResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  updateQuiz: {
    description: 'Update details of a quiz. Only allowed if the quiz is in Draft state.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdParamsSchema,
    response: {
      200: schemas.simpleSuccessMessageSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  scheduleQuiz: {
    description: 'Schedule a quiz start and end times.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdParamsSchema,
    response: {
      200: schemas.simpleSuccessMessageSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  getQuizLink: {
    description: 'Generate or retrieve the shareable joining link for a quiz.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdParamsSchema,
    response: {
      200: schemas.getQuizLinkResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  createInvites: {
    description: 'Manually trigger invitation emails via RabbitMQ Outbox event sourcing.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdParamsSchema,
    response: {
      202: schemas.simpleSuccessMessageSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  getQuizAnalytics: {
    description: 'View quiz analytics.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdParamsSchema,
    response: {
      200: schemas.getQuizAnalyticsResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  listQuizParticipants: {
    description: 'List all participants registered/invited to a specific quiz.',
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdParamsSchema,
    response: {
      200: schemas.getQuizParticipantsResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  getParticipantSubmissions: {
    description: "View specific participant's answer submission history.",
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdAndParticipantIdParamsSchema,
    response: {
      200: schemas.getParticipantSubmissionsResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
  getParticipantScore: {
    description: "Get specific participant's final score for a quiz.",
    tags: ['Admin Quizzes'],
    security: [{ bearerAuth: [] }],
    params: schemas.quizIdAndParticipantIdParamsSchema,
    response: {
      200: schemas.getParticipantScoreResponseSchema,
      401: schemas.errorResponseSchema,
      403: schemas.errorResponseSchema,
    },
  },
} satisfies Record<string, FastifySchema>;
