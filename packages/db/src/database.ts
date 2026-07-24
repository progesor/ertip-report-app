import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { DATABASE_SCHEMA_VERSION, ensureDatabaseSchema } from './schema.ts';

export type DatabaseUserRole = 'owner' | 'manager';
export type DatabaseUserStatus = 'active' | 'disabled';

export interface DatabaseConnectionConfig {
  readonly connectionString: string;
  readonly ssl: boolean;
  readonly maxConnections?: number;
}

export interface DatabaseUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly role: DatabaseUserRole;
  readonly status: DatabaseUserStatus;
  readonly failedLoginCount: number;
  readonly lockedUntil: Date | null;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DatabaseSessionUser {
  readonly sessionId: string;
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: DatabaseUserRole;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly expiresAt: Date;
}

export interface OdooConnectionCheck {
  readonly status: 'success' | 'failure';
  readonly serverVersion: string | null;
  readonly companyCount: number | null;
  readonly durationMs: number;
  readonly safeErrorCode: string | null;
  readonly checkedAt: Date;
}

interface UserRow extends QueryResultRow {
  readonly id: string;
  readonly email: string;
  readonly display_name: string;
  readonly password_hash: string;
  readonly role: DatabaseUserRole;
  readonly status: DatabaseUserStatus;
  readonly failed_login_count: number;
  readonly locked_until: Date | null;
  readonly last_login_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface SessionUserRow extends QueryResultRow {
  readonly session_id: string;
  readonly user_id: string;
  readonly email: string;
  readonly display_name: string;
  readonly role: DatabaseUserRole;
  readonly business_unit_ids: string[] | null;
  readonly expires_at: Date;
}

interface OdooCheckRow extends QueryResultRow {
  readonly status: 'success' | 'failure';
  readonly server_version: string | null;
  readonly company_count: number | null;
  readonly duration_ms: number;
  readonly safe_error_code: string | null;
  readonly checked_at: Date;
}

function mapUser(row: UserRow): DatabaseUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createDatabasePool(config: DatabaseConnectionConfig): Pool {
  return new Pool({
    connectionString: config.connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: config.maxConnections ?? 5,
    ...(config.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

export class AppDatabase {
  public constructor(private readonly pool: Pool) {}

  public async migrate(): Promise<void> {
    await ensureDatabaseSchema(this.pool);
  }

  public async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  public async getSchemaVersion(): Promise<number | null> {
    const result = await this.pool.query<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'schema_version' LIMIT 1",
    );
    const value = result.rows[0]?.value;
    return value === undefined ? null : Number(value);
  }

  public async countUsers(): Promise<number> {
    const result = await this.pool.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
    return Number(result.rows[0]?.count ?? '0');
  }

  public async createInitialOwner(input: {
    readonly email: string;
    readonly displayName: string;
    readonly passwordHash: string;
  }): Promise<DatabaseUser | null> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
      const countResult = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM users',
      );

      if (Number(countResult.rows[0]?.count ?? '0') > 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const userId = randomUUID();
      const result = await client.query<UserRow>(
        `INSERT INTO users (id, email, display_name, password_hash, role)
         VALUES ($1, $2, $3, $4, 'owner')
         RETURNING *`,
        [userId, input.email, input.displayName, input.passwordHash],
      );

      await this.insertAudit(client, {
        actorUserId: userId,
        action: 'owner.bootstrap.created',
        entityType: 'user',
        entityId: userId,
        metadata: { role: 'owner' },
      });
      await client.query('COMMIT');

      const user = result.rows[0];
      return user === undefined ? null : mapUser(user);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async findUserByEmail(email: string): Promise<DatabaseUser | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [email],
    );
    const user = result.rows[0];
    return user === undefined ? null : mapUser(user);
  }

  public async findUserById(userId: string): Promise<DatabaseUser | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [
      userId,
    ]);
    const user = result.rows[0];
    return user === undefined ? null : mapUser(user);
  }

  public async recordLoginFailure(userId: string): Promise<Date | null> {
    const result = await this.pool.query<{ locked_until: Date | null }>(
      `UPDATE users
       SET
         failed_login_count = CASE
           WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1
           ELSE failed_login_count + 1
         END,
         locked_until = CASE
           WHEN (
             CASE
               WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1
               ELSE failed_login_count + 1
             END
           ) >= 5 THEN now() + interval '15 minutes'
           ELSE locked_until
         END,
         updated_at = now()
       WHERE id = $1
       RETURNING locked_until`,
      [userId],
    );

    return result.rows[0]?.locked_until ?? null;
  }

  public async recordLoginSuccess(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE users
       SET failed_login_count = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
       WHERE id = $1`,
      [userId],
    );
  }

  public async createSession(input: {
    readonly userId: string;
    readonly tokenHash: string;
    readonly expiresAt: Date;
    readonly ipHash: string | null;
    readonly userAgent: string | null;
  }): Promise<string> {
    const sessionId = randomUUID();

    await this.pool.query('DELETE FROM sessions WHERE expires_at <= now()');
    await this.pool.query(
      `INSERT INTO sessions (
         id, user_id, token_hash, expires_at, ip_hash, user_agent
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sessionId,
        input.userId,
        input.tokenHash,
        input.expiresAt,
        input.ipHash,
        input.userAgent,
      ],
    );

    return sessionId;
  }

  public async findSessionByTokenHash(tokenHash: string): Promise<DatabaseSessionUser | null> {
    const result = await this.pool.query<SessionUserRow>(
      `SELECT
         sessions.id AS session_id,
         users.id AS user_id,
         users.email,
         users.display_name,
         users.role,
         sessions.expires_at,
         CASE
           WHEN users.role = 'owner' THEN ARRAY(
             SELECT business_units.id::text
             FROM business_units
             WHERE business_units.active = true
             ORDER BY business_units.display_order, business_units.code
           )
           ELSE ARRAY(
             SELECT user_business_unit_scopes.business_unit_id::text
             FROM user_business_unit_scopes
             JOIN business_units
               ON business_units.id = user_business_unit_scopes.business_unit_id
             WHERE user_business_unit_scopes.user_id = users.id
               AND business_units.active = true
             ORDER BY business_units.display_order, business_units.code
           )
         END AS business_unit_ids
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1
         AND sessions.expires_at > now()
         AND users.status = 'active'
       LIMIT 1`,
      [tokenHash],
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    await this.pool.query(
      `UPDATE sessions
       SET last_seen_at = now()
       WHERE id = $1 AND last_seen_at < now() - interval '15 minutes'`,
      [row.session_id],
    );

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      allowedBusinessUnitIds: row.business_unit_ids ?? [],
      expiresAt: row.expires_at,
    };
  }

  public async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  public async invalidateAllSessionsForUser(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  public async recordAudit(input: {
    readonly actorUserId: string | null;
    readonly action: string;
    readonly entityType?: string | null;
    readonly entityId?: string | null;
    readonly businessUnitScope?: string | null;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await this.insertAudit(this.pool, input);
  }

  public async recordOdooConnectionCheck(input: {
    readonly checkedBy: string;
    readonly status: 'success' | 'failure';
    readonly serverVersion: string | null;
    readonly companyCount: number | null;
    readonly durationMs: number;
    readonly safeErrorCode: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO odoo_connection_checks (
         id, checked_by, status, server_version, company_count, duration_ms, safe_error_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        input.checkedBy,
        input.status,
        input.serverVersion,
        input.companyCount,
        input.durationMs,
        input.safeErrorCode,
      ],
    );
  }

  public async getLatestOdooConnectionCheck(): Promise<OdooConnectionCheck | null> {
    const result = await this.pool.query<OdooCheckRow>(
      `SELECT status, server_version, company_count, duration_ms, safe_error_code, checked_at
       FROM odoo_connection_checks
       ORDER BY checked_at DESC
       LIMIT 1`,
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      status: row.status,
      serverVersion: row.server_version,
      companyCount: row.company_count,
      durationMs: row.duration_ms,
      safeErrorCode: row.safe_error_code,
      checkedAt: row.checked_at,
    };
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public get currentSchemaVersion(): number {
    return DATABASE_SCHEMA_VERSION;
  }

  private async insertAudit(
    executor: Pick<Pool | PoolClient, 'query'>,
    input: {
      readonly actorUserId: string | null;
      readonly action: string;
      readonly entityType?: string | null;
      readonly entityId?: string | null;
      readonly businessUnitScope?: string | null;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
  ): Promise<void> {
    await executor.query(
      `INSERT INTO audit_logs (
         id, actor_user_id, action, entity_type, entity_id, business_unit_scope, safe_metadata_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        randomUUID(),
        input.actorUserId,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.businessUnitScope ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }
}
