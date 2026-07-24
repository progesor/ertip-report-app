import type { Pool } from 'pg';

export const DATABASE_SCHEMA_VERSION = 1;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS app_meta (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS business_units (
    id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE,
    display_name text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner', 'manager')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until timestamptz,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (char_length(email) BETWEEN 3 AND 320),
    CHECK (char_length(display_name) BETWEEN 2 AND 120)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (lower(email))`,
  `CREATE TABLE IF NOT EXISTS user_business_unit_scopes (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_unit_id uuid NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, business_unit_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    ip_hash text,
    user_agent text
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_index ON sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS sessions_expires_at_index ON sessions (expires_at)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY,
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    business_unit_scope text,
    safe_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS audit_logs_created_at_index
    ON audit_logs (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS audit_logs_actor_index
    ON audit_logs (actor_user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS odoo_connection_checks (
    id uuid PRIMARY KEY,
    checked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    status text NOT NULL CHECK (status IN ('success', 'failure')),
    server_version text,
    company_count integer,
    duration_ms integer NOT NULL CHECK (duration_ms >= 0),
    safe_error_code text,
    checked_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS odoo_connection_checks_checked_at_index
    ON odoo_connection_checks (checked_at DESC)`,
  `INSERT INTO business_units (id, code, display_name, display_order)
    VALUES
      ('11111111-1111-4111-8111-111111111111', 'international', 'Yurt Dışı', 10),
      ('22222222-2222-4222-8222-222222222222', 'domestic', 'Yurt İçi', 20)
    ON CONFLICT (code) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      display_order = EXCLUDED.display_order,
      updated_at = now()`,
  `INSERT INTO app_meta (key, value)
    VALUES ('schema_version', '${DATABASE_SCHEMA_VERSION}')
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()`,
] as const;

export async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [1_904_202_626]);

    for (const statement of SCHEMA_STATEMENTS) {
      await client.query(statement);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
