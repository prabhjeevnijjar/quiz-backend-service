import { ParticipantAuthRepository } from './auth.repository';

export class ParticipantAuthService {
  constructor(private readonly repo: ParticipantAuthRepository) { }

  async joinQuiz() { }
  async verifyOtp() { }
  async generateJwt() { }
}
