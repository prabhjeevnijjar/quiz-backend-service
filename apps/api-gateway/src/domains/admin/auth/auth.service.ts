import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { AdminAuthRepository, AdminUserRecord } from './auth.repository';
import { loadConfig } from '@quiz/config';

const config = loadConfig();
const JWT_SECRET = config.JWT_SECRET || 'fallback-secret-for-dev-only';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AdminAuthService {
  constructor(
    private readonly repo: AdminAuthRepository,
    private readonly redis: Redis
  ) { }

  /**
   * Logs in an admin by verifying credentials, updating login stats,
   * and generating access & refresh token pairs.
   */
  async login(email: string, password: string): Promise<TokenPair> {
    const admin = await this.repo.findActiveAdminByEmail(email);
    if (!admin) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    // Generate token family & initial JTI
    const familyId = randomUUID();
    const jti = randomUUID();

    const accessToken = this.generateAccessToken(admin);
    const refreshToken = this.generateRefreshToken(admin, jti, familyId);

    // Save active JTI in Redis (expires in 7 days)
    const redisKey = `admin:refresh:family:${familyId}`;
    await this.redis.set(redisKey, jti, 'EX', 7 * 24 * 60 * 60);

    // Update last login timestamp asynchronously
    await this.repo.updateLastLogin(admin.id).catch((err) => {
      // Don't fail login if timestamp update fails, but log it
      console.error('Failed to update admin last login timestamp', err);
    });

    return { accessToken, refreshToken };
  }

  /**
   * Performs Refresh Token Rotation (RTR).
   * Validates old refresh token, detects potential reuse/replay attacks,
   * invalidates compromised families, and issues a fresh token pair.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      throw new Error('Invalid or expired refresh token');
    }

    if (decoded.actorType !== 'admin' || !decoded.jti || !decoded.familyId) {
      throw new Error('Invalid refresh token claims');
    }

    const adminId = decoded.sub;
    const { email, role, jti, familyId } = decoded;

    const redisKey = `admin:refresh:family:${familyId}`;
    const activeJti = await this.redis.get(redisKey);

    if (!activeJti) {
      // Refresh token family has expired or been explicitly revoked
      throw new Error('Session has expired. Please log in again.');
    }

    // Reuse/Replay Detection:
    // If the active JTI in Redis is not the JTI of the token presented,
    // this token has already been used once!
    if (activeJti !== jti) {
      // Revoke the entire token family immediately to isolate breach
      await this.redis.del(redisKey);
      throw new Error('Security Alert: Reuse of refresh token detected. All sessions in this family have been revoked.');
    }

    // Token is valid and unused. Rotate it.
    const newJti = randomUUID();

    // Re-pack admin data for signing
    const adminDummy: AdminUserRecord = {
      id: adminId,
      email,
      role,
      password_hash: '',
      is_active: true,
    };

    const newAccessToken = this.generateAccessToken(adminDummy);
    const newRefreshToken = this.generateRefreshToken(adminDummy, newJti, familyId);

    // Update Redis with the new active JTI
    await this.redis.set(redisKey, newJti, 'EX', 7 * 24 * 60 * 60);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logs out an admin by revoking their refresh token family from Redis.
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const decoded: any = jwt.verify(refreshToken, JWT_SECRET);
      if (decoded.familyId) {
        const redisKey = `admin:refresh:family:${decoded.familyId}`;
        await this.redis.del(redisKey);
      }
    } catch {
      // Do nothing: if token is malformed/expired, it's already invalid
    }
  }

  /**
   * Registers a new admin user.
   */
  async createAdmin(email: string, password: string, role: 'super_admin' | 'admin' = 'admin'): Promise<string> {
    const existing = await this.repo.findActiveAdminByEmail(email);
    if (existing) {
      throw new Error('Admin with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    return this.repo.createAdmin(email, passwordHash, role);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private generateAccessToken(admin: AdminUserRecord): string {
    return jwt.sign(
      {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        actorType: 'admin',
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  private generateRefreshToken(admin: AdminUserRecord, jti: string, familyId: string): string {
    return jwt.sign(
      {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        actorType: 'admin',
        jti,
        familyId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
}
