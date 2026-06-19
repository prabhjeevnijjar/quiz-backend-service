import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import type { ConfirmChannel } from 'amqplib';
import { EXCHANGE_NAMES, INVITES_ROUTING_KEY } from '@quiz/messaging';
import { AdminQuizRepository, AddQuestionData, ListQuizzesResult, QuizDetail, QuizQuestion, UpdateQuizData, InviteParticipantInput } from './quiz.repository';
import { NotFoundError, BadRequestError } from '../../../errors';

export interface QuizSettings {
  shuffle_questions: boolean;
  show_leaderboard: boolean;
  max_participants?: number;
  allow_late_join: boolean;
  late_join_grace_period_minutes?: number; // required when allow_late_join is true
}

export interface UpdateQuizInput {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  password?: string;
  settings?: QuizSettings;
}

export interface CreateQuizInput {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  password?: string;
  settings: QuizSettings;
}

export interface SendInvitesInput {
  email: string;
  name?: string;
}

export interface SendInvitesResult {
  invitedCount: number;
  publishedCount: number;
}

export class AdminQuizService {
  constructor(
    private readonly repo: AdminQuizRepository,
    private readonly amqpChannel: ConfirmChannel,
  ) { }

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
          settings: input.settings,
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

  async listQuizzes(
    adminId: string,
    page: number,
    limit: number,
    status?: string,
  ): Promise<ListQuizzesResult> {
    return this.repo.listQuizzes({ adminId, page, limit, status });
  }

  async getQuizById(quizId: string, adminId: string): Promise<QuizDetail> {
    const quiz = await this.repo.findQuizById(quizId, adminId);
    if (!quiz) {
      throw new NotFoundError('Quiz');
    }
    return quiz;
  }

  async addQuestionsToQuiz(
    quizId: string,
    adminId: string,
    questions: AddQuestionData[],
  ): Promise<{ addedCount: number; questions: QuizQuestion[] }> {
    const quiz = await this.repo.findQuizForModification(quizId, adminId);
    if (!quiz) throw new NotFoundError('Quiz');
    if (quiz.status !== 'draft') throw new BadRequestError('Quiz can only be modified in draft status');
    const inserted = await this.repo.addQuestions(quizId, adminId, questions);
    return { addedCount: inserted.length, questions: inserted };
  }

  async updateQuestion(
    quizId: string,
    adminId: string,
    questionId: string,
    data: AddQuestionData,
  ): Promise<QuizQuestion> {
    const quiz = await this.repo.findQuizForModification(quizId, adminId);
    if (!quiz) throw new NotFoundError('Quiz');
    if (quiz.status !== 'draft') throw new BadRequestError('Quiz can only be modified in draft status');
    const updated = await this.repo.updateQuestion(questionId, quizId, data);
    if (!updated) throw new NotFoundError('Question');
    return updated;
  }

  async deleteQuestion(quizId: string, adminId: string, questionId: string): Promise<void> {
    const quiz = await this.repo.findQuizForModification(quizId, adminId);
    if (!quiz) throw new NotFoundError('Quiz');
    if (quiz.status !== 'draft') throw new BadRequestError('Quiz can only be modified in draft status');
    const deleted = await this.repo.deleteQuestion(questionId, quizId);
    if (!deleted) throw new NotFoundError('Question');
  }

  async generateShareableLink(quizId: string, adminId: string, baseUrl: string): Promise<string> {
    const shareToken = await this.repo.getShareToken(quizId, adminId);
    if (!shareToken) throw new NotFoundError('Quiz');
    // Participants enter the quiz via the public join route keyed by share_token.
    return `${baseUrl.replace(/\/+$/, '')}/quizzes/${shareToken}/join`;
  }

  /**
   * Records the given invitees against the quiz and stages their invitation events via
   * the transactional outbox (atomic), then best-effort publishes those events to the
   * quiz.invites exchange. Publish is best-effort: any event that fails to publish stays
   * in outbox_events with published=false for a relay to pick up later, so the durably
   * recorded intent is never lost and the request still succeeds (202).
   */
  async sendInvites(
    quizId: string,
    adminId: string,
    invitees: SendInvitesInput[],
    baseUrl: string,
  ): Promise<SendInvitesResult> {
    // Normalize: lowercase + dedupe by email; default missing names to the email local-part.
    const seen = new Set<string>();
    const normalized: InviteParticipantInput[] = [];
    for (const invitee of invitees) {
      const email = invitee.email.trim().toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      const name = invitee.name?.trim() || email.split('@')[0];
      normalized.push({ email, name });
    }

    const outcome = await this.repo.createInvites(quizId, adminId, normalized, baseUrl);
    if (!outcome.ok) {
      if (outcome.reason === 'not_found') throw new NotFoundError('Quiz');
      throw new BadRequestError(`Cannot send invites for a ${outcome.status} quiz`);
    }

    const { invitedCount, outboxRows } = outcome.result;

    // Publish concurrently on the confirm channel; collect the ids that the broker confirmed.
    const settled = await Promise.allSettled(
      outboxRows.map((row) => this.publishInvite(row.payload).then(() => row.id)),
    );
    const publishedIds: string[] = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        publishedIds.push(r.value);
      } else {
        // Best-effort: the row stays published=false for a relay to retry. Log so a
        // publishedCount < invitedCount is diagnosable instead of silently dropped.
        console.error(`Failed to publish invite event ${outboxRows[i].id}`, r.reason);
      }
    });

    await this.repo.markOutboxPublished(publishedIds);

    return { invitedCount, publishedCount: publishedIds.length };
  }

  /** Publishes one invite event with publisher confirms; resolves only once the broker ACKs. */
  private publishInvite(payload: unknown): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.amqpChannel.publish(
        EXCHANGE_NAMES.INVITES,
        INVITES_ROUTING_KEY,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true, contentType: 'application/json' },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  async updateQuizDetails(quizId: string, adminId: string, input: UpdateQuizInput): Promise<void> {
    const quiz = await this.repo.findQuizById(quizId, adminId);
    if (!quiz) throw new NotFoundError('Quiz');
    if (quiz.status !== 'draft') throw new BadRequestError('Quiz can only be modified in draft status');

    const effectiveStart = new Date(input.start_time ?? quiz.start_time);
    const effectiveEnd = new Date(input.end_time ?? quiz.end_time);
    if (effectiveEnd <= effectiveStart) {
      throw new BadRequestError('end_time must be after start_time');
    }

    const repoData: UpdateQuizData = {
      title: input.title,
      description: input.description,
      startTime: input.start_time,
      endTime: input.end_time,
      settings: input.settings,
    };

    if (input.password) {
      const salt = await bcrypt.genSalt(10);
      repoData.passwordHash = await bcrypt.hash(input.password, salt);
    }

    const updated = await this.repo.updateQuiz(quizId, adminId, repoData);
    if (!updated) throw new NotFoundError('Quiz');
  }
  async scheduleQuiz() { }
}
