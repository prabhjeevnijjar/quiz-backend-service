import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ParticipantAuthService } from './auth/auth.service';
import { ParticipantAuthRepository } from './auth/auth.repository';
import { ParticipantQuizService } from './quiz/quiz.service';
import { ParticipantQuizRepository } from './quiz/quiz.repository';
import { authenticate } from '../../middleware/auth.middleware';
import { participantDocs } from './participant.docs';

export default async function participantRoutes(fastify: FastifyInstance) {
  // Type the instance with the Zod provider so request/response types are
  // inferred from the schemas referenced in ./participant.docs.
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();

  const authRepo = new ParticipantAuthRepository(fastify.db.write, fastify.db.read, fastify.redis);
  const authService = new ParticipantAuthService(authRepo);

  const quizRepo = new ParticipantQuizRepository(fastify.db.write, fastify.db.read, fastify.redis);
  const quizService = new ParticipantQuizService(quizRepo, fastify.amqp.channel);

  // Routes past the OTP step require a valid participant JWT.
  const participantAuth = authenticate(['participant']);

  typedFastify.post('/quizzes/:slug/join', { schema: participantDocs.join }, async (request, reply) => {
    // TODO: Join quiz using URL. Expects name, email, and password if required.
    // Triggers OTP email via event.
    return reply.status(202).send({ message: 'OTP sent to email (Not Implemented)' });
  });

  typedFastify.post('/quizzes/:slug/verify-otp', { schema: participantDocs.verifyOtp }, async (request, reply) => {
    // TODO: Verify email using OTP. Returns participant JWT.
    return reply.send({ token: 'jwt-token-here (Not Implemented)' });
  });

  typedFastify.post('/quizzes/:slug/waiting-room', { preHandler: participantAuth, schema: participantDocs.waitingRoom }, async (request, reply) => {
    // TODO: Enter waiting room before quiz start (updates Redis presence)
    return reply.send({ message: 'Entered waiting room (Not Implemented)' });
  });

  typedFastify.get('/quizzes/:slug/questions', { preHandler: participantAuth, schema: participantDocs.questions }, async (request, reply) => {
    // TODO: Fetch quiz questions (only if quiz is Live)
    return reply.send({ questions: [] });
  });

  typedFastify.post('/quizzes/:slug/submit', { preHandler: participantAuth, schema: participantDocs.submit }, async (request, reply) => {
    // TODO: Submit answers. Must use Transactional Outbox pattern as per architecture.
    // Returns 202 Accepted.
    return reply.status(202).send({
      submissionId: 'uuid-here',
      status: 'processing',
    });
  });

  typedFastify.get('/quizzes/:slug/leaderboard', { preHandler: participantAuth, schema: participantDocs.leaderboard }, async (request, reply) => {
    // TODO: HTTP snapshot of the leaderboard from Redis
    return reply.send({ leaderboard: [] });
  });

  // Note: WebSocket endpoint for live leaderboard (/quizzes/:slug/leaderboard/live)
  // will be handled in a separate WS gateway/plugin setup.
}
