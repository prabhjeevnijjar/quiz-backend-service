import { Pool } from 'pg';
import { QuizStatus, QuestionType } from '../../../constants/quiz';
import type { QuizSettings } from '../../../constants/quiz';

export interface CreateQuizData {
  createdBy: string;
  title: string;
  description?: string;
  shareToken: string;
  passwordHash: string | null;
  startTime: string;
  endTime: string;
  settings: QuizSettings;
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

type QuizQuestionBase = { id: string; question_text: string; points: number; order_index: number; created_at: string; updated_at: string };
type QuizQuestionOption = { id: string; text: string };

export type QuizQuestion =
  | (QuizQuestionBase & { question_type: 'multiple_choice'; options: QuizQuestionOption[]; correct_answer: string })
  | (QuizQuestionBase & { question_type: 'multi_select'; options: QuizQuestionOption[]; correct_answer: string[] })
  | (QuizQuestionBase & { question_type: 'true_false'; options: QuizQuestionOption[]; correct_answer: string })
  | (QuizQuestionBase & { question_type: 'short_answer'; options: null; correct_answer: null });

export interface QuizDetail {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  start_time: string;
  end_time: string;
  question_count: number;
  participant_count: number;
  share_token: string;
  settings: QuizSettings;
  questions: QuizQuestion[];
  created_at: string;
  updated_at: string;
}

export interface AddQuestionData {
  question_text: string;
  question_type: QuestionType;
  options: { id: string; text: string }[] | null;
  correct_answer: string | string[] | null;
  points: number;
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

  async findQuizById(quizId: string, adminId: string): Promise<QuizDetail | null> {
    const quizRes = await this.readPool.query(
      `SELECT id, title, description, status, start_time, end_time,
              question_count, participant_count, share_token, settings,
              created_at, updated_at
       FROM quizzes
       WHERE id = $1 AND created_by = $2`,
      [quizId, adminId]
    );

    if (quizRes.rowCount === 0) return null;

    const questionsRes = await this.readPool.query(
      `SELECT id, question_text, question_type, options, correct_answer,
              points, order_index, created_at, updated_at
       FROM questions
       WHERE quiz_id = $1
       ORDER BY order_index ASC`,
      [quizId]
    );

    return {
      ...quizRes.rows[0],
      questions: questionsRes.rows,
    } as QuizDetail;
  }

  async findQuizForModification(quizId: string, adminId: string): Promise<{ id: string; status: QuizStatus } | null> {
    const res = await this.readPool.query(
      'SELECT id, status FROM quizzes WHERE id = $1 AND created_by = $2',
      [quizId, adminId]
    );
    return res.rowCount === 0 ? null : res.rows[0] as { id: string; status: QuizStatus };
  }

  async addQuestions(quizId: string, adminId: string, questions: AddQuestionData[]): Promise<QuizQuestion[]> {
    const client = await this.writePool.connect();
    try {
      await client.query('BEGIN');

      // Verify ownership inside the transaction with a row lock.
      // FOR UPDATE prevents concurrent requests from racing past this check.
      const ownerRes = await client.query(
        'SELECT id FROM quizzes WHERE id = $1 AND created_by = $2 FOR UPDATE',
        [quizId, adminId]
      );
      if (ownerRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return [];
      }

      const maxRes = await client.query(
        'SELECT COALESCE(MAX(order_index), 0) AS max_order FROM questions WHERE quiz_id = $1',
        [quizId]
      );
      let nextOrder = (maxRes.rows[0].max_order as number) + 1;

      const inserted: QuizQuestion[] = [];
      for (const q of questions) {
        const res = await client.query(
          `INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer, points, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [quizId, q.question_text, q.question_type, q.options !== null ? JSON.stringify(q.options) : null, JSON.stringify(q.correct_answer), q.points, nextOrder++]
        );
        inserted.push(res.rows[0] as QuizQuestion);
      }

      await client.query(
        'UPDATE quizzes SET question_count = question_count + $1, updated_at = now() WHERE id = $2',
        [questions.length, quizId]
      );

      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateQuestion(questionId: string, quizId: string, data: AddQuestionData): Promise<QuizQuestion | null> {
    const res = await this.writePool.query(
      `UPDATE questions
       SET question_text = $1, question_type = $2, options = $3, correct_answer = $4, points = $5, updated_at = now()
       WHERE id = $6 AND quiz_id = $7
       RETURNING *`,
      [data.question_text, data.question_type, data.options !== null ? JSON.stringify(data.options) : null, JSON.stringify(data.correct_answer), data.points, questionId, quizId]
    );
    return res.rowCount === 0 ? null : res.rows[0] as QuizQuestion;
  }

  async deleteQuestion(questionId: string, quizId: string): Promise<boolean> {
    const client = await this.writePool.connect();
    try {
      await client.query('BEGIN');

      const delRes = await client.query(
        'DELETE FROM questions WHERE id = $1 AND quiz_id = $2',
        [questionId, quizId]
      );

      if (delRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        'UPDATE quizzes SET question_count = question_count - 1, updated_at = now() WHERE id = $1',
        [quizId]
      );

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateQuiz() { }
}
