import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDatabasePool,
  ensureDatabaseSchema,
  getOdooCurrencyCodeMetaKey,
  queryPersonnelPerformanceReport,
  searchPersonnelPerformanceDirectory,
  upsertOdooCurrencyCodes,
} from '@ertip/db';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizePersonnelPerformanceFilters,
} from '@ertip/reporting';

const connectionString = process.env.DATABASE_URL?.trim();
const domesticBusinessUnitId = '22222222-2222-4222-8222-222222222222';

test(
  'personnel performance query, amount currencies, directory and scope reconcile PostgreSQL fixture',
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const pool = createDatabasePool({ connectionString, ssl: false, maxConnections: 2 });
    const runId = randomUUID();
    const salespersonIds: [number, number] = [940_010, 940_020];
    const customerIds: [number, number, number] = [940_101, 940_102, 940_103];
    const orderIds: [number, number, number, number, number, number, number, number, number] = [
      940_001,
      940_002,
      940_003,
      940_004,
      940_005,
      940_006,
      940_007,
      940_008,
      940_009,
    ];
    const euroCurrencyId = 990_202;

    try {
      await ensureDatabaseSchema(pool);
      await upsertOdooCurrencyCodes(pool, [{ odooCurrencyId: euroCurrencyId, code: 'EUR' }]);
      await pool.query(
        `INSERT INTO sync_runs (
           id, kind, status, source_count, processed_count, reconciles,
           requested_at, started_at, completed_at, updated_at
         ) VALUES ($1, 'sale_order', 'succeeded', 9, 9, true, now(), now(), now(), now())`,
        [runId],
      );
      await pool.query(
        `INSERT INTO odoo_salespeople (
           odoo_user_id, display_name, active, default_company_id, write_date
         ) VALUES
           ($1, 'Performance Salesperson A', true, 1, now()),
           ($2, 'Performance Salesperson B', true, 1, now())`,
        salespersonIds,
      );
      await pool.query(
        `INSERT INTO odoo_customers (
           odoo_partner_id, display_name, active, customer_rank, write_date
         ) VALUES
           ($1, 'Performance Customer A', true, 1, now()),
           ($2, 'Performance Customer B', true, 1, now()),
           ($3, 'Performance Customer C', true, 1, now())`,
        customerIds,
      );
      await pool.query(
        `INSERT INTO odoo_sale_orders (
           odoo_id, business_unit_id, odoo_company_id, odoo_salesperson_id,
           odoo_partner_id, odoo_currency_id, source_state, create_date,
           date_order, validity_date, amount_total, write_date
         ) VALUES
           ($1, $10, 1, $12, $14, 1, 'sale', '2026-07-03 08:00:00+00', '2026-07-03 08:00:00+00', NULL, 1000, now()),
           ($2, $10, 1, $12, $15, 1, 'draft', '2026-07-08 08:00:00+00', '2026-07-08 08:00:00+00', '2026-08-10', 500, now()),
           ($3, $10, 1, $12, $14, $17, 'cancel', '2026-07-12 08:00:00+00', '2026-07-12 08:00:00+00', NULL, 300, now()),
           ($4, $10, 1, $12, $16, $17, 'sale', '2026-07-20 08:00:00+00', '2026-07-20 08:00:00+00', NULL, 700, now()),
           ($5, $10, 1, $12, $14, 1, 'sale', '2026-06-05 08:00:00+00', '2026-06-05 08:00:00+00', NULL, 800, now()),
           ($6, $10, 1, $12, $15, 1, 'draft', '2026-06-10 08:00:00+00', '2026-06-10 08:00:00+00', '2026-08-10', 400, now()),
           ($7, $10, 1, $13, $14, 1, 'sale', '2026-07-04 08:00:00+00', '2026-07-04 08:00:00+00', NULL, 600, now()),
           ($8, $10, 1, $13, $16, $17, 'sale', '2026-07-18 08:00:00+00', '2026-07-18 08:00:00+00', NULL, 200, now()),
           ($9, $11, 25, $12, $14, 31, 'sale', '2026-07-05 08:00:00+00', '2026-07-05 08:00:00+00', NULL, 9000, now())`,
        [
          ...orderIds,
          INTERNATIONAL_BUSINESS_UNIT_ID,
          domesticBusinessUnitId,
          ...salespersonIds,
          ...customerIds,
          euroCurrencyId,
        ],
      );

      const directory = await searchPersonnelPerformanceDirectory(pool, {
        businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        search: 'Salesperson A',
      });
      assert.equal(directory.length, 1);
      assert.equal(directory[0]?.quotationCount, 6);
      assert.equal(directory[0]?.realizedCount, 3);

      const filters = normalizePersonnelPerformanceFilters({
        request: {
          businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
          salespersonId: salespersonIds[0],
          dateFrom: '2026-07-01',
          dateTo: '2026-08-01',
        },
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        now: new Date('2026-07-26T12:00:00.000Z'),
      });
      const report = await queryPersonnelPerformanceReport(pool, {
        filters,
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        generatedAt: new Date('2026-07-26T12:00:00.000Z'),
      });

      assert.equal(report.metrics.quotationCount, 4);
      assert.equal(report.metrics.realizedCount, 2);
      assert.equal(report.previousMetrics.quotationCount, 2);
      assert.equal(report.teamComparison.activeMemberCount, 2);
      assert.equal(report.teamComparison.median.quotationCount, 3);
      assert.equal(report.scope.serverEnforced, true);
      assert.equal(report.details.some(({ id }) => id === orderIds[8]), false);
      const usd = report.currencies.find(({ currencyCode }) => currencyCode === 'USD');
      assert.equal(usd?.current.quotationAmount, '1500');
      assert.equal(usd?.current.realizedAmount, '1000');
      assert.equal(usd?.teamMedian.realizedAmount, '800');
      const eur = report.currencies.find(({ currencyCode }) => currencyCode === 'EUR');
      assert.equal(eur?.current.quotationAmount, '1000');
      assert.equal(eur?.current.realizedAmount, '700');
      assert.equal(eur?.teamMedian.realizedAmount, '450');

      await assert.rejects(
        queryPersonnelPerformanceReport(pool, {
          filters,
          allowedBusinessUnitIds: [domesticBusinessUnitId],
        }),
        /REPORT_SCOPE_DENIED/u,
      );
    } finally {
      await pool.query('DELETE FROM odoo_sale_orders WHERE odoo_id = ANY($1::int[])', [orderIds]).catch(() => undefined);
      await pool.query('DELETE FROM odoo_customers WHERE odoo_partner_id = ANY($1::int[])', [customerIds]).catch(() => undefined);
      await pool.query('DELETE FROM odoo_salespeople WHERE odoo_user_id = ANY($1::int[])', [salespersonIds]).catch(() => undefined);
      await pool.query('DELETE FROM sync_runs WHERE id = $1', [runId]).catch(() => undefined);
      await pool.query('DELETE FROM app_meta WHERE key = $1', [getOdooCurrencyCodeMetaKey(euroCurrencyId)]).catch(() => undefined);
      await pool.end();
    }
  },
);
