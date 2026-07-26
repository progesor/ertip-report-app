\set ON_ERROR_STOP on

WITH fixture_payload AS (
  SELECT concat_ws(
    '|',
    coalesce((
      SELECT string_agg(
        concat_ws(':', id::text, email, display_name, role, status),
        ',' ORDER BY id
      )
      FROM users
    ), ''),
    coalesce((
      SELECT string_agg(
        concat_ws(':', id::text, action, coalesce(entity_type, ''), coalesce(entity_id, '')),
        ',' ORDER BY id
      )
      FROM audit_logs
    ), ''),
    coalesce((
      SELECT string_agg(
        concat_ws(':', id::text, status, processed_count::text, reconciles::text),
        ',' ORDER BY id
      )
      FROM sync_runs
    ), ''),
    coalesce((
      SELECT string_agg(
        concat_ws(
          ':',
          odoo_id::text,
          business_unit_id::text,
          odoo_company_id::text,
          coalesce(odoo_salesperson_id::text, ''),
          odoo_partner_id::text,
          odoo_currency_id::text,
          source_state,
          amount_total::text
        ),
        ',' ORDER BY odoo_id
      )
      FROM odoo_sale_orders
    ), '')
  ) AS value
)
SELECT jsonb_build_object(
  'sale_orders', (SELECT count(*) FROM odoo_sale_orders),
  'active_users', (SELECT count(*) FROM users WHERE status = 'active'),
  'audit_events', (SELECT count(*) FROM audit_logs),
  'schema_version', (SELECT value FROM app_meta WHERE key = 'schema_version'),
  'latest_sync_run', coalesce((
    SELECT id::text
    FROM sync_runs
    WHERE status = 'succeeded' AND reconciles = true
    ORDER BY completed_at DESC
    LIMIT 1
  ), 'none'),
  'fixture_hash', (SELECT md5(value) FROM fixture_payload)
)::text;
