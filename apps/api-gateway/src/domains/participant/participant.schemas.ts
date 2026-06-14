import { z } from 'zod';

// ─── Shared Schemas ─────────────────────────────────────────────────────────

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// ─── Params ───────────────────────────────────────────────────────────────

export const quizSlugParamsSchema = z.object({
  slug: z.string().describe('Public slug of the quiz, taken from the joining link'),
});

// ─── Join ─────────────────────────────────────────────────────────────────

export const joinBodySchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).describe('Display name shown on the leaderboard'),
  email: z.string().email({ message: 'Invalid email address' }).describe('Participant email; the OTP is sent here'),
  password: z.string().optional().describe('Required only when the quiz is password-protected'),
});

export const joinResponse202Schema = z.object({
  message: z.string(),
});

// ─── Verify OTP ─────────────────────────────────────────────────────────────

export const verifyOtpBodySchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }).describe('Email the OTP was sent to'),
  otp: z.string().min(4).max(8).describe('One-time password received via email'),
});

export const verifyOtpResponse200Schema = z.object({
  token: z.string().describe('Participant JWT used to authorize subsequent quiz requests'),
});

// ─── Waiting Room ─────────────────────────────────────────────────────────

export const waitingRoomResponse200Schema = z.object({
  message: z.string(),
});

// ─── Questions ──────────────────────────────────────────────────────────────

export const getQuestionsResponse200Schema = z.object({
  questions: z.array(z.any()),
});

// ─── Submit ─────────────────────────────────────────────────────────────────

export const submitBodySchema = z.object({
  answers: z.array(z.any()).describe("Array of the participant's answers"),
});

export const submitResponse202Schema = z.object({
  submissionId: z.string().describe('Identifier of the accepted submission'),
  status: z.string().describe('Async processing status (e.g. "processing")'),
});

// ─── Leaderboard ──────────────────────────────────────────────────────────

export const getLeaderboardResponse200Schema = z.object({
  leaderboard: z.array(z.any()),
});
