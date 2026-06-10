import { Pool } from 'pg';

export class AdminAnalyticsRepository {
  constructor(private readonly readPool: Pool) { }

  async getQuizScoreDistribution() { }
  async getParticipantSubmissions() { }
}
