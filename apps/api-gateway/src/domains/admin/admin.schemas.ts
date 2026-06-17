import { z } from 'zod';

// ─── Shared Schemas ─────────────────────────────────────────────────────────

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// ─── Admin Auth Schemas ──────────────────────────────────────────────────────

export const loginBodySchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

export const loginResponse200Schema = z.object({
  accessToken: z.string().describe('Short-lived JWT (15 mins) used to access protected routes'),
  refreshToken: z.string().describe('Long-lived JWT (7 days) used to fetch new access tokens'),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().describe('The active refresh token issued to the admin.'),
});

export const refreshResponse200Schema = z.object({
  accessToken: z.string().describe('New access token'),
  refreshToken: z.string().describe('New rotated refresh token'),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().describe('The active refresh token to revoke.'),
});

export const logoutResponse200Schema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const createAdminBodySchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
  role: z.enum(['super_admin', 'admin']).optional().default('admin'),
});

export const createAdminResponse201Schema = z.object({
  success: z.boolean(),
  message: z.string(),
  adminId: z.string().uuid(),
});

// ─── Quiz Management Schemas ─────────────────────────────────────────────────

export const createQuizBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  start_time: z.string().datetime({ message: 'start_time must be a valid ISO 8601 datetime' }),
  end_time: z.string().datetime({ message: 'end_time must be a valid ISO 8601 datetime' }),
  password: z.string().min(1).optional(),
  settings: z.object({
    shuffle_questions: z.boolean(),
    show_leaderboard: z.boolean(),
    max_participants: z.number().int().positive().optional(),
    allow_late_join: z.boolean(),
    late_join_grace_period_minutes: z.number().int().min(1).max(60).optional(),
  }).superRefine((settings, ctx) => {
    if (settings.allow_late_join && settings.late_join_grace_period_minutes === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['late_join_grace_period_minutes'],
        message: 'late_join_grace_period_minutes is required when allow_late_join is true',
      });
    }
    if (!settings.allow_late_join && settings.late_join_grace_period_minutes !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['late_join_grace_period_minutes'],
        message: 'late_join_grace_period_minutes has no effect when allow_late_join is false',
      });
    }
  }),
});

export const createQuizResponse201Schema = z.object({
  success: z.boolean(),
  quizId: z.string().uuid(),
});

export const quizIdParamsSchema = z.object({
  id: z.string().uuid().describe('The UUID of the quiz'),
});

export const quizIdAndParticipantIdParamsSchema = z.object({
  id: z.string().uuid().describe('The UUID of the quiz'),
  participantId: z.string().uuid().describe('The UUID of the participant'),
});

export const simpleSuccessMessageSchema = z.object({
  message: z.string(),
});

export const getQuizzesResponseSchema = z.object({
  quizzes: z.array(z.any()),
});

export const getQuizResponseSchema = z.object({
  quiz: z.any(),
});

export const getQuizLinkResponseSchema = z.object({
  link: z.string().url(),
});

export const getQuizAnalyticsResponseSchema = z.object({
  analytics: z.any(),
});

export const getQuizParticipantsResponseSchema = z.object({
  participants: z.array(z.any()),
});

export const getParticipantSubmissionsResponseSchema = z.object({
  submissions: z.array(z.any()),
});

export const getParticipantScoreResponseSchema = z.object({
  score: z.number(),
});
