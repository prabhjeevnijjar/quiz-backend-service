import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import jwt from 'jsonwebtoken';
import { loadConfig } from '@quiz/config';

const config = loadConfig();
const JWT_SECRET = config.JWT_SECRET || 'fallback-secret-for-dev-only';

// ─── Type Augmentation ───────────────────────────────────────────────────────
declare module 'fastify' {
  interface FastifyRequest {
    admin?: {
      id: string;
      email: string;
      role: 'super_admin' | 'admin';
    };
    participant?: {
      id: string;
      email: string;
      name: string;
    };
  }
}

export interface DecodedJwtPayload {
  sub: string;
  email: string;
  role?: 'super_admin' | 'admin';
  name?: string;
  actorType: 'admin' | 'participant';
}

/**
 * Creates a Fastify preHandler hook to authenticate and authorize requests
 * based on token verification and actor type.
 *
 * @param allowedActors Array of allowed actor types (e.g. ['admin', 'participant'])
 */
export function authenticate(allowedActors: ('admin' | 'participant')[]): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected Bearer token.',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedJwtPayload;

      if (!decoded.actorType || !allowedActors.includes(decoded.actorType)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'You do not have permission to access this resource.',
        });
      }

      // Attach decoded payload to the request object based on the actor type
      if (decoded.actorType === 'admin') {
        request.admin = {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role || 'admin',
        };
      } else if (decoded.actorType === 'participant') {
        request.participant = {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name || '',
        };
      }
    } catch (err) {
      request.log.warn({ err }, 'JWT verification failed');
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token.',
      });
    }
  };
}
