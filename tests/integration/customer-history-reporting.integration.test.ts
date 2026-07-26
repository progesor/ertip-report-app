import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDatabasePool,
  ensureDatabaseSchema,
  queryCustomerQuotationHistoryReport,
  searchCustomerQuotationHistoryDirectory,
} from '@ertip/db';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeCustomerQuotationHistoryFilters,
} from '@ertip/reporting';

const connectionString = process.env.DATABASE_URL?.trim();
const domesticBusinessUnitId = '22222222-2222-4222-8222-222222222222';

test(
  'customer history query, directory and server scope reconcile PostgreSQL fixture',
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const pool = createDatabasePool({ connectionString, ssl: false, maxConnections: 2 });
    const runId = randomUUID();
    const salespersonIds: [number, number] = [930_010, 930_020];
    const customerIds: [number, number] = [930_101, 930_102];
    const orderIds: [number, number, number, number, number, number] = [
      930_001,
      930_002,
      930_003,
      930_004,
      930_005,
      930_006,
    ];

    try {
      await ensureDatabaseSchema(pool);
      await pool.query(
        `INSERT INTO sync_runs (
           id, kind, status, source_count, processed_count, reconciles,
           requested_at, started_at, completed_at, updated_at
         ) VALUES ($1, 'sale_order', 'succeeded', 6, 6, true, now(), now(), now(), now())`,
        [runId],
      );
      await pool.query(
        `INSERT INTO odoo_salespeople (
           odoo_user_id, display_name, active, default_company_id, write_date
         ) VALUES
           ($1, 'History Salesperson A', true, 1, now()),
           ($2, 'History Salesperson B', true, 1, now())`,
        salespersonIds,
      );
      await pool.query(
        `INSERT INTO odoo_customers (
           odoo_partner_id, display_name, active, customer_rank, write_date
         ) VALUES
           ($1, 'History Customer Atlas', true, 1, now()),
           ($2, 'History Customer Other', true, 1, now())`,
        customerIds,
      );
      await pool.query(
        `INSERT INTO odoo_sale_orders (
           odoo_id, business_unit_id, odoo_company_id, odoo_salesperson_id,
           odoo_partner_id, odoo_currency_id, source_state, create_date,
           date_order, validity_date, amount_total, write_date
         ) VALUES
           ($1, $7, 1, $9, $11, 1, 'cancel', '2026-01-10 08:00:00+00', '2026-01-10 08:00:00+00', NULL, 1000, now()),
           ($2, $7, 1, $9, $11, 1, 'sale', '2026-02-20 08:00:00+00', '2026-02-24 08:00:00+00', NULL, 2000, now()),
           ($3, $7, 1, $10, $11, 1, 'draft', '2026-04-01 08:00:00+00', '2026-04-01 08:00:00+00', '2026-08-05', 3000, now()),
           ($4, $7, 1, NULL, $11, 1, 'sent', '2026-05-15 08:00:00+00', '2026-05-15 08:00:00+00', '2026-06-01', 4000, now()),
           ($5, $7, 1, $9, $12, 1, 'sale', '2026-03-01 08:00:00+00', '2026-03-03 08:00:00+00', NULL, 5000, now()),
           ($6, $8, 25, $9, $11, 31, 'sale', '2026-06-01 08:00:00+00', '2026-06-02 08:00:00+00', NULL, 6000, now())`,
        [
          ...orderIds,
          INTERNATIONAL_BUSINESS_UNIT_ID,
          domesticBusinessUnitId,
          ...salespersonIds,
          ...customerIds,
        ],
      );

      const directory = await searchCustomerQuotationHistoryDirectory(pool, {
        businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        search: 'Atlas',
      });
      assert.equal(directory.length, 1);
      assert.equal(directory[0]?.quotationCount, 4);

      const filters = normalizeCustomerQuotationHistoryFilters({
        request: {
          businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
          customerId: customerIds[0],
          dateFrom: '2026-01-01',
          dateTo: '2026-07-01',
        },
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        now: new Date('2026-07-26T12:00:00.000Z'),
      });
      const report = await queryCustomerQuotationHistoryReport(pool, {
        filters,
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        generatedAt: new Date('2026-07-26T12:00:00.000Z'),
      });

      assert.equal(report.metrics.quotationCount, 4);
      assert.equal(report.metrics.realizedCount, 1);
      assert.equal(report.metrics.openCount, 1);
      assert.equal(report.metrics.notRealizedCount, 2);
      assert.deepEqual(report.timeline.map(({ id }) => id), orderIds.slice(0, 4).reverse());
      assert.equal(report.salespersonHistory.length, 3);
      assert.equal(report.scope.serverEnforced, true);
      assert.equal(report.timeline.some(({ id }) => id === orderIds[5]), false);

      await assert.rejects(
        queryCustomerQuotationHistoryReport(pool, {
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
      await pool.end();
    }
  },
);
