import { Pool } from 'pg';
import Redis from 'ioredis';

export class ParticipantAuthRepository {
  constructor(
    private readonly writePool: Pool,
    private readonly readPool: Pool,
    private readonly redis: Redis
  ) { }

  async saveParticipant() { }
  async findParticipantByEmail() { }
  async storeOtp() { }
  async verifyOtp() { }
}
