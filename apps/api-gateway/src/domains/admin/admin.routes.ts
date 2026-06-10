import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AdminQuizService } from './quiz/quiz.service';
import { AdminQuizRepository } from './quiz/quiz.repository';
import { AdminAnalyticsService } from './analytics/analytics.service';
import { AdminAnalyticsRepository } from './analytics/analytics.repository';

export default async function adminRoutes(fastify: FastifyInstance) {
  const quizRepo = new AdminQuizRepository(fastify.db.write, fastify.db.read);
  const quizService = new AdminQuizService(quizRepo);

  const analyticsRepo = new AdminAnalyticsRepository(fastify.db.read);
  const analyticsService = new AdminAnalyticsService(analyticsRepo);

  fastify.post('/admin/quizzes', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Create quiz (Title, Description, initial settings)
    // Needs Zod validation for body
    return reply.status(201).send({ message: 'Quiz created (Not Implemented)' });
  });

  fastify.get('/admin/quizzes', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: List all quizzes with pagination
    return reply.send({ quizzes: [] });
  });

  fastify.get('/admin/quizzes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Get quiz details including questions and schedule
    return reply.send({ quiz: {} });
  });

  fastify.patch('/admin/quizzes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Edit quiz (only allowed if in Draft state)
    // This includes updating questions, changing passwords, etc.
    return reply.send({ message: 'Quiz updated (Not Implemented)' });
  });

  fastify.patch('/admin/quizzes/:id/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Schedule quiz start and end times
    return reply.send({ message: 'Quiz scheduled (Not Implemented)' });
  });


  fastify.get('/admin/quizzes/:id/link', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Generate or retrieve shareable quiz link
    return reply.send({ link: 'https://quiz.example.com/q/slug' });
  });


  fastify.post('/admin/quizzes/:id/invites', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Manually trigger invitation emails via RabbitMQ Outbox
    return reply.status(202).send({ message: 'Invites queued (Not Implemented)' });
  });


  fastify.get('/admin/quizzes/:id/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: View quiz analytics (Score distributions, completion funnels)
    return reply.send({ analytics: {} });
  });

  fastify.get('/admin/quizzes/:id/participants', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: List all participants for a given quiz
    return reply.send({ participants: [] });
  });

  fastify.get('/admin/quizzes/:id/participants/:participantId/submissions', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: View specific participant's submission history
    return reply.send({ submissions: [] });
  });

  fastify.get('/admin/quizzes/:id/participants/:participantId/score', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: View specific participant's final score
    return reply.send({ score: 0 });
  });
}
