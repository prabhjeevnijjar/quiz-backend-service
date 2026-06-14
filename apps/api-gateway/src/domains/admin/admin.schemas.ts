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
