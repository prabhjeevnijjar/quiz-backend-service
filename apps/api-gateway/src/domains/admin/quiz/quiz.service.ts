import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { AdminQuizRepository } from './quiz.repository';

export interface QuizSettings {
  shuffle_questions: boolean;
  show_leaderboard: boolean;
  max_participants?: number;
  allow_late_join: boolean;
  late_join_grace_period_minutes?: number; // required when allow_late_join is true
}

export interface CreateQuizInput {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  password?: string;
  settings?: QuizSettings;
}

export class AdminQuizService {
  constructor(private readonly repo: AdminQuizRepository) { }

  async createNewQuiz(input: CreateQuizInput, adminId: string): Promise<string> {
    const start = new Date(input.start_time);
    const end = new Date(input.end_time);
    if (end <= start) {
      throw new Error('end_time must be after start_time');
    }

    let passwordHash: string | null = null;
    if (input.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(input.password, salt);
    }
// max attempt just a validation for one in a million chance of collision of share tokens, but we can increase it if needed. this is not really a performance concern since the chance of collision is extremely low with 32 bytes of randomness.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.repo.createQuiz({
          createdBy: adminId,
          title: input.title,
          description: input.description,
          shareToken: randomBytes(32).toString('hex'),
          passwordHash,
          startTime: input.start_time,
          endTime: input.end_time,
          settings: input.settings ?? {},
        });
      } catch (err: any) {
        const isTokenCollision =
          err.code === '23505' && err.constraint === 'quizzes_share_token_key';
        if (!isTokenCollision || attempt === MAX_ATTEMPTS) throw err;
      }
    }

    // Unreachable — loop always returns or throws
    throw new Error('Failed to generate a unique share token');
  }

  async updateQuizDetails() { }
  async scheduleQuiz() { }
  async generateShareableLink() { }
}
