import { Pool } from 'pg';

export interface CreateQuizData {
  createdBy: string;
  title: string;
  description?: string;
  shareToken: string;
  passwordHash: string | null;
  startTime: string;
  endTime: string;
  settings: object;
}

export class AdminQuizRepository {
  constructor(
    private readonly writePool: Pool,
    private readonly readPool: Pool
  ) { }

  async createQuiz(data: CreateQuizData): Promise<string> {
    const query = `
      INSERT INTO quizzes (created_by, title, description, share_token, password_hash, start_time, end_time, settings)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const res = await this.writePool.query(query, [
      data.createdBy,
      data.title,
      data.description ?? null,
      data.shareToken,
      data.passwordHash,
      data.startTime,
      data.endTime,
      JSON.stringify(data.settings),
    ]);
    return res.rows[0].id;
  }

  async findQuizById() { }
  async listQuizzes() { }
  async updateQuiz() { }
}
