export const QUIZ_STATUSES = ['draft', 'scheduled', 'live', 'completed', 'archived'] as const;
export type QuizStatus = typeof QUIZ_STATUSES[number];

export const QUESTION_TYPES = ['multiple_choice', 'multi_select', 'true_false', 'short_answer'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];

export interface QuizSettings {
  shuffle_questions: boolean;
  show_leaderboard: boolean;
  max_participants?: number;
  allow_late_join: boolean;
  late_join_grace_period_minutes?: number;
}
