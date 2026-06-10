import { ParticipantQuizRepository } from './quiz.repository';
import amqplib from 'amqplib';

export class ParticipantQuizService {
  constructor(
    private readonly repo: ParticipantQuizRepository,
    private readonly amqpChannel: amqplib.ConfirmChannel
  ) { }

  async enterWaitingRoom() { }
  async fetchQuestions() { }
  async submitAnswers() { }
  async fetchLeaderboard() { }
}
