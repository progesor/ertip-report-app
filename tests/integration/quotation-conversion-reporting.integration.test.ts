import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDatabasePool,
  ensureDatabaseSchema,
  queryQuotationConversionReport,
} from '@ertip/db';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeQuotationConversionFilters,
} from '@ertip/reporting';

const connectionString = process.env.DATABASE_URL?.trim();
const domesticBusinessUnitId = '22222222-2222-4222-8222-222222222222';

test(
  'quotation conversion query reconciles cohort, confirmation lag, anomalies and scope',
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const pool = createDatabasePool({ connectionString, ssl: false, maxConnections: 2 });
    const runId = randomUUID();
    const salespersonIds: [number, number] = [950_010, 950_020];
    const customerIds: [number, number, number] = [950_101, 950_102, 950_103];
    const orderIds: [number, number, number, number, number, number, number, number, number] = [
      950_001,
      950_002,
      950_003,
      950_004,
      950_005,
      950_006,
      950_007,
      950_008,
      950_009,
    ];

    try {
      await ensureDatabaseSchema(pool);
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
           ($1, 'Conversion Salesperson A', true, 1, now()),
           ($2, 'Conversion Salesperson B', true, 1, now())`,
        salespersonIds,
      );
      await pool.query(
        `INSERT INTO odoo_customers (
           odoo_partner_id, display_name, active, customer_rank, write_date
         ) VALUES
           ($1, 'Conversion Customer A', true, 1, now()),
           ($2, 'Conversion Customer B', true, 1, now()),
           ($3, 'Conversion Customer C', true, 1, now())`,
        customerIds,
      );
      await pool.query(
        `INSERT INTO odoo_sale_orders (
           odoo_id, business_unit_id, odoo_company_id, odoo_salesperson_id,
           odoo_partner_id, odoo_currency_id, source_state, create_date,
           date_order, validity_date, amount_total, write_date
         ) VALUES
           ($1, $10, 1, $12, $14, 1, 'sale', '2026-07-03 08:00:00+00', '2026-07-03 10:00:00+00', NULL, 1000, now()),
           ($2, $10, 1, $12, $15, 1, 'sale', '2026-07-05 08:00:00+00', '2026-07-10 10:00:00+00', NULL, 1500, now()),
           ($3, $10, 1, $13, $15, 1, 'sale', '2026-07-15 08:00:00+00', '2026-08-24 10:00:00+00', NULL, 2200, now()),
           ($4, $10, 1, $13, $16, 1, 'sale', '2026-07-20 08:00:00+00', '2026-07-19 10:00:00+00', NULL, 900, now()),
           ($5, $10, 1, $12, $14, 1, 'draft', '2026-07-22 08:00:00+00', '2026-07-22 08:00:00+00', '2026-08-15', 700, now()),
           ($6, $10, 1, $13, $16, 1, 'cancel', '2026-07-24 08:00:00+00', '2026-07-24 08:00:00+00', NULL, 500, now()),
           ($7, $10, 1, $12, $14, 1, 'sale', '2026-06-02 08:00:00+00', '2026-06-05 10:00:00+00', NULL, 1100, now()),
           ($8, $10, 1, $13, $15, 1, 'draft', '2026-06-12 08:00:00+00', '2026-06-12 08:00:00+00', '2026-08-15', 800, now()),
           ($9, $11, 25, $12, $14, 31, 'sale', '2026-07-05 08:00:00+00', '2026-07-05 10:00:00+00', NULL, 9000, now())`,
        [
          ...orderIds,
          INTERNATIONAL_BUSINESS_UNIT_ID,
          domesticBusinessUnitId,
          ...salespersonIds,
          ...customerIds,
        ],
      );

      const filters = normalizeQuotationConversionFilters({
        request: {
          businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
          dateFrom: '2026-07-01',
          dateTo: '2026-08-01',
        },
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        now: new Date('2026-07-26T12:00:00.000Z'),
      });
      const report = await queryQuotationConversionReport(pool, {
        filters,
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        generatedAt: new Date('2026-07-26T12:00:00.000Z'),
      });

      assert.equal(report.metrics.quotationCount, 6);
      assert.equal(report.metrics.convertedCount, 4);
      assert.equal(report.metrics.conversionRate, 4 / 6);
      assert.equal(report.metrics.validLagConvertedCount, 3);
      assert.equal(report.metrics.sameMonthConvertedCount, 2);
      assert.equal(report.metrics.crossMonthConvertedCount, 1);
      assert.equal(report.metrics.averageLagDays, 15);
      assert.equal(report.metrics.medianLagDays, 5);
      assert.equal(report.metrics.p90LagDays, 40);
      assert.equal(report.metrics.anomalyCount, 1);
      assert.equal(report.previousMetrics.quotationCount, 2);
      assert.equal(report.previousMetrics.convertedCount, 1);
      assert.equal(report.anomalies.confirmationBeforeQuotationCount, 1);
      assert.equal(report.details.some(({ id }) => id === orderIds[8]), false);
      assert.equal(report.details.find(({ id }) => id === orderIds[3])?.lagDays, -1);
      assert.equal(report.salespeople.find(({ id }) => id === salespersonIds[0])?.metrics.quotationCount, 3);
      assert.equal(report.customers.find(({ id }) => id === customerIds[1])?.metrics.convertedCount, 2);
      assert.equal(report.scope.serverEnforced, true);
      assert.equal(report.lastSyncAt === null, false);

      await assert.rejects(
        queryQuotationConversionReport(pool, {
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
