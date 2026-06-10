import { AdminQuizRepository } from './quiz.repository';

export class AdminQuizService {
  constructor(private readonly repo: AdminQuizRepository) { }

  async createNewQuiz() { }
  async updateQuizDetails() { }
  async scheduleQuiz() { }
  async generateShareableLink() { }
}
