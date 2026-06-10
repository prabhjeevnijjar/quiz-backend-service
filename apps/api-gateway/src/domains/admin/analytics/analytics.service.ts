import { AdminAnalyticsRepository } from './analytics.repository';

export class AdminAnalyticsService {
  constructor(private readonly repo: AdminAnalyticsRepository) { }

  async generateQuizReport() { }
  async fetchParticipantHistory() { }
}
