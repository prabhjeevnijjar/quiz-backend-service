export const QUIZ_STATUSES = ['draft', 'scheduled', 'live', 'completed', 'archived'] as const;

export type QuizStatus = typeof QUIZ_STATUSES[number];
