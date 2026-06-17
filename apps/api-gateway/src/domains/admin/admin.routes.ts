import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AdminQuizService } from './quiz/quiz.service';
import { AdminQuizRepository } from './quiz/quiz.repository';
import { AdminAnalyticsService } from './analytics/analytics.service';
import { AdminAnalyticsRepository } from './analytics/analytics.repository';
import { AdminAuthRepository } from './auth/auth.repository';
import { AdminAuthService } from './auth/auth.service';
import { authenticate } from '../../middleware/auth.middleware';
import { adminDocs } from './admin.docs';

export default async function adminRoutes(fastify: FastifyInstance) {
  // Type the instance with the Zod provider so request/response types are
  // inferred from the schemas referenced in ./admin.docs.
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();

  const quizRepo = new AdminQuizRepository(fastify.db.write, fastify.db.read);
  const quizService = new AdminQuizService(quizRepo);

  const analyticsRepo = new AdminAnalyticsRepository(fastify.db.read);
  const analyticsService = new AdminAnalyticsService(analyticsRepo);

  const authRepo = new AdminAuthRepository(fastify.db.write, fastify.db.read);
  const authService = new AdminAuthService(authRepo, fastify.redis);

  const adminAuth = authenticate(['admin']);

  // ─── Authentication ─────────────────────────────────────────────────────────

  typedFastify.post('/admin/login', { schema: adminDocs.login }, async (request, reply) => {
    const { email, password } = request.body;
    try {
      const tokens = await authService.login(email, password);
      return reply.send(tokens);
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message || 'Authentication failed',
      });
    }
  });

  typedFastify.post('/admin/refresh', { schema: adminDocs.refresh }, async (request, reply) => {
    const { refreshToken } = request.body;
    try {
      const tokens = await authService.refresh(refreshToken);
      return reply.send(tokens);
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message || 'Invalid or expired refresh token',
      });
    }
  });

  typedFastify.post('/admin/logout', { schema: adminDocs.logout }, async (request, reply) => {
    const { refreshToken } = request.body;
    await authService.logout(refreshToken);
    return reply.status(200).send({ success: true, message: 'Logged out successfully' });
  });

  typedFastify.post('/admin/users', { preHandler: adminAuth, schema: adminDocs.createAdmin }, async (request, reply) => {
    const { email, password, role } = request.body;
    try {
      const newAdminId = await authService.createAdmin(email, password, role);
      return reply.status(201).send({
        success: true,
        message: 'Admin created successfully',
        adminId: newAdminId,
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Failed to create admin',
      });
    }
  });

  // ─── Quiz Management ────────────────────────────────────────────────────────

  typedFastify.post('/admin/quizzes', { preHandler: adminAuth, schema: adminDocs.createQuiz }, async (request, reply) => {
    try {
      const quizId = await quizService.createNewQuiz(request.body, request.admin!.id);
      return reply.status(201).send({ success: true, quizId });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Failed to create quiz',
      });
    }
  });

  typedFastify.get('/admin/quizzes', { preHandler: adminAuth, schema: adminDocs.listQuizzes }, async (request, reply) => {
    const { page, limit, status } = request.query;
    const { quizzes, total } = await quizService.listQuizzes(request.admin!.id, page, limit, status);
    return reply.send({
      quizzes,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  });

  typedFastify.get('/admin/quizzes/:id', { preHandler: adminAuth, schema: adminDocs.getQuiz }, async (request, reply) => {
    const quiz = await quizService.getQuizById(request.params.id, request.admin!.id);
    return reply.send({ quiz });
  });

  typedFastify.patch('/admin/quizzes/:id', { preHandler: adminAuth, schema: adminDocs.updateQuiz }, async (request, reply) => {
    // TODO: Edit quiz (only allowed if in Draft state)
    return reply.send({ message: 'Quiz updated (Not Implemented)' });
  });

  typedFastify.patch('/admin/quizzes/:id/schedule', { preHandler: adminAuth, schema: adminDocs.scheduleQuiz }, async (request, reply) => {
    // TODO: Schedule quiz start and end times
    return reply.send({ message: 'Quiz scheduled (Not Implemented)' });
  });

  typedFastify.get('/admin/quizzes/:id/link', { preHandler: adminAuth, schema: adminDocs.getQuizLink }, async (request, reply) => {
    // TODO: Generate or retrieve shareable quiz link
    return reply.send({ link: 'https://quiz.example.com/q/slug' });
  });

  typedFastify.post('/admin/quizzes/:id/invites', { preHandler: adminAuth, schema: adminDocs.createInvites }, async (request, reply) => {
    // TODO: Manually trigger invitation emails via RabbitMQ Outbox
    return reply.status(202).send({ message: 'Invites queued (Not Implemented)' });
  });

  typedFastify.get('/admin/quizzes/:id/analytics', { preHandler: adminAuth, schema: adminDocs.getQuizAnalytics }, async (request, reply) => {
    // TODO: View quiz analytics
    return reply.send({ analytics: {} });
  });

  typedFastify.get('/admin/quizzes/:id/participants', { preHandler: adminAuth, schema: adminDocs.listQuizParticipants }, async (request, reply) => {
    // TODO: List all participants for a given quiz
    return reply.send({ participants: [] });
  });

  typedFastify.get('/admin/quizzes/:id/participants/:participantId/submissions', { preHandler: adminAuth, schema: adminDocs.getParticipantSubmissions }, async (request, reply) => {
    // TODO: View specific participant's submission history
    return reply.send({ submissions: [] });
  });

  typedFastify.get('/admin/quizzes/:id/participants/:participantId/score', { preHandler: adminAuth, schema: adminDocs.getParticipantScore }, async (request, reply) => {
    // TODO: View specific participant's final score
    return reply.send({ score: 0 });
  });
}
