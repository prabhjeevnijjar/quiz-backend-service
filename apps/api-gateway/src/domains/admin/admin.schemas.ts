import { z } from 'zod';
import { QUIZ_STATUSES } from '../../constants/quiz';

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

export const updateQuizBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  start_time: z.string().datetime({ message: 'start_time must be a valid ISO 8601 datetime' }).optional(),
  end_time: z.string().datetime({ message: 'end_time must be a valid ISO 8601 datetime' }).optional(),
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
  }).optional(),
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

export const listQuizzesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(QUIZ_STATUSES).optional(),
});

// pg returns timestamptz columns as Date objects — transform to ISO string for JSON output
const pgTimestamp = z.union([z.string(), z.date()]).transform(v =>
  v instanceof Date ? v.toISOString() : v
);

export const quizSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(QUIZ_STATUSES),
  start_time: pgTimestamp,
  end_time: pgTimestamp,
  question_count: z.number(),
  participant_count: z.number(),
  share_token: z.string(),
  created_at: pgTimestamp,
});

export const getQuizzesResponseSchema = z.object({
  quizzes: z.array(quizSummarySchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    total_pages: z.number(),
  }),
});

const questionBase = {
  id: z.string().uuid(),
  question_text: z.string(),
  points: z.number(),
  order_index: z.number(),
  created_at: pgTimestamp,
  updated_at: pgTimestamp,
};

const optionSchema = z.object({ id: z.string().uuid(), text: z.string() });

// Discriminated union — each type enforces its own options + correct_answer shape
export const questionSchema = z.discriminatedUnion('question_type', [
  // Single correct option selected from a list
  z.object({ ...questionBase, question_type: z.literal('multiple_choice'), options: z.array(optionSchema), correct_answer: z.string() }),
  // Multiple correct options selected from a list
  z.object({ ...questionBase, question_type: z.literal('multi_select'), options: z.array(optionSchema), correct_answer: z.array(z.string()) }),
  // Stored as MCQ internally with two options (true / false)
  z.object({ ...questionBase, question_type: z.literal('true_false'), options: z.array(optionSchema).length(2), correct_answer: z.string() }),
  // Free text — no options, no correct_answer (manual grading)
  z.object({ ...questionBase, question_type: z.literal('short_answer'), options: z.null(), correct_answer: z.null() }),
]);

const quizSettingsSchema = z.object({
  shuffle_questions: z.boolean(),
  show_leaderboard: z.boolean(),
  max_participants: z.number().optional(),
  allow_late_join: z.boolean(),
  late_join_grace_period_minutes: z.number().optional(),
});

export const getQuizResponseSchema = z.object({
  quiz: z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(QUIZ_STATUSES),
    start_time: pgTimestamp,
    end_time: pgTimestamp,
    question_count: z.number(),
    participant_count: z.number(),
    share_token: z.string(),
    settings: quizSettingsSchema,
    questions: z.array(questionSchema),
    created_at: pgTimestamp,
    updated_at: pgTimestamp,
  }),
});

// ─── Question Management Schemas ─────────────────────────────────────────────

const addQuestionInputBase = {
  question_text: z.string().min(1),
  points: z.number().int().min(1).default(1),
};

export const addQuestionItemSchema = z.discriminatedUnion('question_type', [
  z.object({ ...addQuestionInputBase, question_type: z.literal('multiple_choice'), options: z.array(optionSchema).min(2), correct_answer: z.string() }),
  z.object({ ...addQuestionInputBase, question_type: z.literal('multi_select'), options: z.array(optionSchema).min(2), correct_answer: z.array(z.string()).min(1) }),
  z.object({ ...addQuestionInputBase, question_type: z.literal('true_false'), options: z.array(optionSchema).length(2), correct_answer: z.string() }),
  z.object({ ...addQuestionInputBase, question_type: z.literal('short_answer'), options: z.null(), correct_answer: z.null() }),
]);

export const addQuestionsBodySchema = z.object({
  questions: z.array(addQuestionItemSchema).min(1).max(100),
});

export const questionParamsSchema = z.object({
  id: z.string().uuid().describe('The UUID of the quiz'),
  questionId: z.string().uuid().describe('The UUID of the question'),
});

export const addQuestionsResponse201Schema = z.object({
  success: z.boolean(),
  addedCount: z.number(),
  questions: z.array(questionSchema),
});

export const updateQuestionResponse200Schema = z.object({
  success: z.boolean(),
  question: questionSchema,
});

export const deleteQuestionResponse200Schema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const getQuizLinkResponseSchema = z.object({
  link: z.string().url(),
});

// ─── Invite Schemas ──────────────────────────────────────────────────────────

export const createInvitesBodySchema = z.object({
  invitees: z.array(
    z.object({
      email: z.string().email({ message: 'Invalid email address' }),
      // Optional — defaults to the email's local-part server-side (participants.name is NOT NULL)
      name: z.string().min(1).max(255).optional(),
    }),
  ).min(1, { message: 'At least one invitee is required' }).max(500),
});

export const createInvitesResponse202Schema = z.object({
  message: z.string(),
  invitedCount: z.number().describe('Number of participants recorded/invited for the quiz'),
  publishedCount: z.number().describe('Number of invite events published to the broker in this request'),
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
