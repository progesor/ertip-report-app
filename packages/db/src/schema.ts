import type { Pool } from 'pg';

export const DATABASE_SCHEMA_VERSION = 2;

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
  `ALTER TABLE business_units ADD COLUMN IF NOT EXISTS odoo_company_id integer`,
  `ALTER TABLE business_units ADD COLUMN IF NOT EXISTS source_currency_id integer`,
  `ALTER TABLE business_units ADD COLUMN IF NOT EXISTS source_currency_code text`,
  `ALTER TABLE business_units ADD COLUMN IF NOT EXISTS mapping_verified_at timestamptz`,
  `CREATE UNIQUE INDEX IF NOT EXISTS business_units_odoo_company_unique
    ON business_units (odoo_company_id)
    WHERE odoo_company_id IS NOT NULL`,
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
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id uuid PRIMARY KEY,
    kind text NOT NULL DEFAULT 'sale_order' CHECK (kind IN ('sale_order')),
    status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
    date_from date,
    date_to date,
    cursor_source_id integer NOT NULL DEFAULT 0 CHECK (cursor_source_id >= 0),
    page_size integer NOT NULL DEFAULT 200 CHECK (page_size BETWEEN 25 AND 500),
    source_count integer CHECK (source_count >= 0),
    processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
    upserted_salespeople integer NOT NULL DEFAULT 0 CHECK (upserted_salespeople >= 0),
    upserted_customers integer NOT NULL DEFAULT 0 CHECK (upserted_customers >= 0),
    upserted_orders integer NOT NULL DEFAULT 0 CHECK (upserted_orders >= 0),
    deleted_stale_orders integer NOT NULL DEFAULT 0 CHECK (deleted_stale_orders >= 0),
    source_counts_json jsonb,
    local_counts_json jsonb,
    reconciles boolean,
    safe_error_code text,
    error_stage text,
    requested_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (date_to IS NULL OR date_from IS NULL OR date_to > date_from)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_single_active_sale_order
    ON sync_runs (kind)
    WHERE status IN ('queued', 'running')`,
  `CREATE INDEX IF NOT EXISTS sync_runs_requested_at_index
    ON sync_runs (requested_at DESC)`,
  `CREATE TABLE IF NOT EXISTS odoo_salespeople (
    odoo_user_id integer PRIMARY KEY,
    display_name text NOT NULL,
    active boolean,
    default_company_id integer,
    write_date timestamptz,
    synced_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS odoo_customers (
    odoo_partner_id integer PRIMARY KEY,
    display_name text NOT NULL,
    active boolean,
    company_id integer,
    commercial_partner_id integer,
    customer_rank integer,
    write_date timestamptz,
    synced_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS odoo_sale_orders (
    odoo_id integer PRIMARY KEY,
    business_unit_id uuid NOT NULL REFERENCES business_units(id),
    odoo_company_id integer NOT NULL,
    odoo_salesperson_id integer REFERENCES odoo_salespeople(odoo_user_id),
    odoo_partner_id integer NOT NULL REFERENCES odoo_customers(odoo_partner_id),
    odoo_currency_id integer NOT NULL,
    source_state text NOT NULL CHECK (source_state IN ('draft', 'sent', 'sale', 'cancel')),
    create_date timestamptz NOT NULL,
    date_order timestamptz NOT NULL,
    validity_date date,
    amount_total numeric(20, 6) NOT NULL,
    write_date timestamptz NOT NULL,
    last_seen_sync_run_id uuid REFERENCES sync_runs(id) ON DELETE SET NULL,
    synced_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS odoo_sale_orders_business_unit_create_index
    ON odoo_sale_orders (business_unit_id, create_date DESC, odoo_id DESC)`,
  `CREATE INDEX IF NOT EXISTS odoo_sale_orders_company_state_index
    ON odoo_sale_orders (odoo_company_id, source_state)`,
  `CREATE INDEX IF NOT EXISTS odoo_sale_orders_salesperson_create_index
    ON odoo_sale_orders (odoo_salesperson_id, create_date DESC)`,
  `CREATE INDEX IF NOT EXISTS odoo_sale_orders_partner_create_index
    ON odoo_sale_orders (odoo_partner_id, create_date DESC)`,
  `CREATE INDEX IF NOT EXISTS odoo_sale_orders_write_date_index
    ON odoo_sale_orders (write_date, odoo_id)`,
  `INSERT INTO business_units (
      id, code, display_name, display_order, odoo_company_id,
      source_currency_id, source_currency_code, mapping_verified_at
    ) VALUES
      (
        '11111111-1111-4111-8111-111111111111', 'international', 'Yurt Dışı', 10,
        1, 1, 'USD', '2026-07-25T15:29:19Z'
      ),
      (
        '22222222-2222-4222-8222-222222222222', 'domestic', 'Yurt İçi', 20,
        25, 31, 'TRY', '2026-07-25T15:29:19Z'
      )
    ON CONFLICT (code) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      display_order = EXCLUDED.display_order,
      odoo_company_id = EXCLUDED.odoo_company_id,
      source_currency_id = EXCLUDED.source_currency_id,
      source_currency_code = EXCLUDED.source_currency_code,
      mapping_verified_at = EXCLUDED.mapping_verified_at,
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
