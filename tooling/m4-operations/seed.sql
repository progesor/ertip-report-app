\set ON_ERROR_STOP on

INSERT INTO users (
  id, email, display_name, password_hash, role, status, created_at, updated_at
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'm4-rehearsal@ertip.invalid',
  'M4 Rehearsal Owner',
  'rehearsal-only-not-a-runtime-credential',
  'owner',
  'active',
  '2026-07-26T00:00:00Z',
  '2026-07-26T00:00:00Z'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO user_business_unit_scopes (user_id, business_unit_id, created_at)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '2026-07-26T00:00:00Z'
) ON CONFLICT DO NOTHING;

INSERT INTO audit_logs (
  id, actor_user_id, action, entity_type, entity_id,
  business_unit_scope, safe_metadata_json, created_at
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'm4.rehearsal.seeded',
  'operations_rehearsal',
  'fixture-v1',
  '11111111-1111-4111-8111-111111111111',
  '{"fixture":"m4-operations-v1"}'::jsonb,
  '2026-07-26T00:01:00Z'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO sync_runs (
  id, kind, status, requested_by, cursor_source_id, page_size,
  source_count, processed_count, upserted_salespeople, upserted_customers,
  upserted_orders, deleted_stale_orders, source_counts_json,
  local_counts_json, reconciles, requested_at, started_at, completed_at, updated_at
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'sale_order',
  'succeeded',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  7001,
  200,
  1,
  1,
  1,
  1,
  1,
  0,
  '{"total":1,"companies":{"1":1}}'::jsonb,
  '{"total":1,"companies":{"1":1}}'::jsonb,
  true,
  '2026-07-26T00:02:00Z',
  '2026-07-26T00:02:01Z',
  '2026-07-26T00:02:02Z',
  '2026-07-26T00:02:02Z'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO odoo_salespeople (
  odoo_user_id, display_name, active, default_company_id, write_date, synced_at
) VALUES (
  7,
  'M4 Rehearsal Salesperson',
  true,
  1,
  '2026-07-25T23:59:00Z',
  '2026-07-26T00:02:02Z'
) ON CONFLICT (odoo_user_id) DO NOTHING;

INSERT INTO odoo_customers (
  odoo_partner_id, display_name, active, company_id, commercial_partner_id,
  customer_rank, write_date, synced_at
) VALUES (
  900001,
  'M4 Rehearsal Customer',
  true,
  1,
  900001,
  1,
  '2026-07-25T23:59:00Z',
  '2026-07-26T00:02:02Z'
) ON CONFLICT (odoo_partner_id) DO NOTHING;

INSERT INTO odoo_sale_orders (
  odoo_id, business_unit_id, odoo_company_id, odoo_salesperson_id,
  odoo_partner_id, odoo_currency_id, source_state, create_date, date_order,
  validity_date, amount_total, write_date, last_seen_sync_run_id, synced_at
) VALUES (
  7001,
  '11111111-1111-4111-8111-111111111111',
  1,
  7,
  900001,
  1,
  'sale',
  '2026-06-15T10:00:00Z',
  '2026-06-15T10:01:00Z',
  '2026-06-30',
  1250.000000,
  '2026-07-25T23:59:00Z',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '2026-07-26T00:02:02Z'
) ON CONFLICT (odoo_id) DO NOTHING;
