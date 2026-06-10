import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ParticipantAuthService } from './auth/auth.service';
import { ParticipantAuthRepository } from './auth/auth.repository';
import { ParticipantQuizService } from './quiz/quiz.service';
import { ParticipantQuizRepository } from './quiz/quiz.repository';

export default async function participantRoutes(fastify: FastifyInstance) {
  const authRepo = new ParticipantAuthRepository(fastify.db.write, fastify.db.read, fastify.redis);
  const authService = new ParticipantAuthService(authRepo);

  const quizRepo = new ParticipantQuizRepository(fastify.db.write, fastify.db.read, fastify.redis);
  const quizService = new ParticipantQuizService(quizRepo, fastify.amqp.channel);


  fastify.post('/quizzes/:slug/join', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Join quiz using URL. Expects name, email, and password if required.
    // Triggers OTP email via event.
    return reply.status(202).send({ message: 'OTP sent to email (Not Implemented)' });
  });

  fastify.post('/quizzes/:slug/verify-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Verify email using OTP. Returns participant JWT.
    return reply.send({ token: 'jwt-token-here (Not Implemented)' });
  });


  fastify.post('/quizzes/:slug/waiting-room', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Enter waiting room before quiz start (updates Redis presence)
    return reply.send({ message: 'Entered waiting room (Not Implemented)' });
  });

  fastify.get('/quizzes/:slug/questions', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Fetch quiz questions (only if quiz is Live)
    return reply.send({ questions: [] });
  });

  fastify.post('/quizzes/:slug/submit', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Submit answers. Must use Transactional Outbox pattern as per architecture.
    // Returns 202 Accepted.
    return reply.status(202).send({
      submissionId: 'uuid-here',
      status: 'processing'
    });
  });


  fastify.get('/quizzes/:slug/leaderboard', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: HTTP snapshot of the leaderboard from Redis
    return reply.send({ leaderboard: [] });
  });

  // Note: WebSocket endpoint for live leaderboard (/quizzes/:slug/leaderboard/live)
  // will be handled in a separate WS gateway/plugin setup.
}
