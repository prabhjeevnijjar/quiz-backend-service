import { Pool } from 'pg';
import Redis from 'ioredis';

export class ParticipantQuizRepository {
  constructor(
    private readonly writePool: Pool,
    private readonly readPool: Pool,
    private readonly redis: Redis
  ) { }

  async getQuizQuestions() { }
  async saveSubmissionAndOutbox() { }
  async getLeaderboard() { }
  async addToWaitingRoom() { }
}
