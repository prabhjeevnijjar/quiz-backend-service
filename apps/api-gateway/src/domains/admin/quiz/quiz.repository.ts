import { Pool } from 'pg';
import { QuizStatus } from '../../../constants/quiz';

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

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  start_time: string;
  end_time: string;
  question_count: number;
  participant_count: number;
  share_token: string;
  created_at: string;
}

export interface ListQuizzesOptions {
  adminId: string;
  page: number;
  limit: number;
  status?: string;
}

export interface ListQuizzesResult {
  quizzes: QuizSummary[];
  total: number;
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

  async listQuizzes(opts: ListQuizzesOptions): Promise<ListQuizzesResult> {
    const { adminId, page, limit, status } = opts;
    const offset = (page - 1) * limit;
    const params: unknown[] = [adminId, limit, offset];

    const statusFilter = status ? `AND status = $${params.push(status)}` : '';

    const dataQuery = `
      SELECT id, title, description, status,
             start_time, end_time, question_count,
             participant_count, share_token, created_at
      FROM quizzes
      WHERE created_by = $1 ${statusFilter}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM quizzes
      WHERE created_by = $1 ${statusFilter}
    `;

    const countParams = status ? [adminId, status] : [adminId];

    const [dataRes, countRes] = await Promise.all([
      this.readPool.query(dataQuery, params),
      this.readPool.query(countQuery, countParams),
    ]);

    return {
      quizzes: dataRes.rows as QuizSummary[],
      total: countRes.rows[0].total,
    };
  }

  async findQuizById() { }
  async updateQuiz() { }
}
