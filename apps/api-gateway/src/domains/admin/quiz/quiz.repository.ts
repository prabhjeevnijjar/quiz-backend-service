import { Pool } from 'pg';

export class AdminQuizRepository {
  constructor(
    private readonly writePool: Pool,
    private readonly readPool: Pool
  ) { }

  async createQuiz() { }
  async findQuizById() { }
  async listQuizzes() { }
  async updateQuiz() { }
}
