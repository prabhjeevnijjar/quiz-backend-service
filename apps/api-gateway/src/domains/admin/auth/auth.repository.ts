import { Pool } from 'pg';

export interface AdminUserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: 'super_admin' | 'admin';
  is_active: boolean;
}

export class AdminAuthRepository {
  constructor(
    private readonly writePool: Pool,
    private readonly readPool: Pool
  ) { }

  /**
   * Finds an active admin user by their email address.
   */
  async findActiveAdminByEmail(email: string): Promise<AdminUserRecord | null> {
    const query = `
      SELECT id, email, password_hash, role, is_active
      FROM admin_users
      WHERE email = $1 AND is_active = true
      LIMIT 1
    `;
    const res = await this.readPool.query(query, [email.toLowerCase().trim()]);
    if (res.rowCount === 0) {
      return null;
    }
    return res.rows[0] as AdminUserRecord;
  }

  /**
   * Updates the last_login_at timestamp for a given admin user.
   */
  async updateLastLogin(adminId: string): Promise<void> {
    const query = `
      UPDATE admin_users
      SET last_login_at = now(), updated_at = now()
      WHERE id = $1
    `;
    await this.writePool.query(query, [adminId]);
  }

  /**
   * Creates a new admin user in the database.
   */
  async createAdmin(email: string, passwordHash: string, role: 'super_admin' | 'admin'): Promise<string> {
    const query = `
      INSERT INTO admin_users (email, password_hash, role)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const res = await this.writePool.query(query, [
      email.toLowerCase().trim(),
      passwordHash,
      role
    ]);
    return res.rows[0].id;
  }
}
