import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDatabasePool,
  getOdooCurrencyCodeMetaKey,
  queryMonthlyQuotationReportWithAmounts,
  upsertOdooCurrencyCodes,
} from '@ertip/db';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeMonthlyQuotationReportFilters,
} from '@ertip/reporting';

const connectionString = process.env.DATABASE_URL?.trim();

test(
  'monthly quotation report reconciles PostgreSQL fixture with scoped filters and separated source currencies',
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const pool = createDatabasePool({ connectionString, ssl: false, maxConnections: 2 });
    const runId = randomUUID();
    const customerIds = [910_101, 910_202];
    const salespersonId = 910_010;
    const orderIds = [910_001, 910_002, 910_003, 910_004];
    const euroCurrencyId = 990_002;

    try {
      const { ensureDatabaseSchema } = await import('@ertip/db');
      await ensureDatabaseSchema(pool);
      await upsertOdooCurrencyCodes(pool, [
        { odooCurrencyId: euroCurrencyId, code: 'EUR' },
      ]);
      await pool.query(
        `INSERT INTO sync_runs (
           id, kind, status, source_count, processed_count, reconciles,
           requested_at, started_at, completed_at, updated_at
         ) VALUES ($1, 'sale_order', 'succeeded', 4, 4, true, now(), now(), now(), now())`,
        [runId],
      );
      await pool.query(
        `INSERT INTO odoo_salespeople (
           odoo_user_id, display_name, active, default_company_id, write_date
         ) VALUES ($1, 'Integration Salesperson', true, 1, now())`,
        [salespersonId],
      );
      await pool.query(
        `INSERT INTO odoo_customers (
           odoo_partner_id, display_name, active, customer_rank, write_date
         ) VALUES
           ($1, 'Integration Customer A', true, 1, now()),
           ($2, 'Integration Customer B', true, 1, now())`,
        customerIds,
      );
      await pool.query(
        `INSERT INTO odoo_sale_orders (
           odoo_id, business_unit_id, odoo_company_id, odoo_salesperson_id,
           odoo_partner_id, odoo_currency_id, source_state, create_date,
           date_order, validity_date, amount_total, write_date
         ) VALUES
           ($1, $5, 1, $6, $7, 1, 'sale', '2026-07-03 08:00:00+00', '2026-07-05 09:00:00+00', NULL, 1000, now()),
           ($2, $5, 1, NULL, $7, 31, 'draft', '2026-07-08 08:00:00+00', '2026-07-08 08:00:00+00', NULL, 800, now()),
           ($3, $5, 1, $6, $8, $9, 'draft', '2026-07-10 08:00:00+00', '2026-07-10 08:00:00+00', '2026-07-12', 500, now()),
           ($4, $5, 1, $6, $8, 1, 'sale', '2026-06-09 08:00:00+00', '2026-06-12 08:00:00+00', NULL, 700, now())`,
        [
          ...orderIds,
          INTERNATIONAL_BUSINESS_UNIT_ID,
          salespersonId,
          customerIds[0],
          customerIds[1],
          euroCurrencyId,
        ],
      );
      const filters = normalizeMonthlyQuotationReportFilters({
        request: {
          businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
          dateFrom: '2026-07-01',
          dateTo: '2026-08-01',
        },
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        now: new Date('2026-07-25T12:00:00.000Z'),
      });
      const result = await queryMonthlyQuotationReportWithAmounts(pool, {
        filters,
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        generatedAt: new Date('2026-07-25T12:00:00.000Z'),
      });

      assert.equal(result.businessUnit.displayName, 'Yurt Dışı');
      assert.equal(result.businessUnit.currencyCode, 'USD');
      assert.equal(result.metrics.quotationCount, 3);
      assert.equal(result.metrics.realizedCount, 1);
      assert.equal(result.metrics.openCount, 1);
      assert.equal(result.metrics.expiredCount, 1);
      assert.equal(result.previousMetrics.quotationCount, 1);
      assert.equal(result.openWithoutValidityCount, 1);
      assert.equal(result.salespeople.find(({ salespersonId: id }) => id === null)?.metrics.openCount, 1);
      assert.equal(result.customers.length, 2);
      assert.equal(result.details.length, 3);
      assert.equal(result.details.find(({ id }) => id === orderIds[0])?.currencyCode, 'USD');
      assert.equal(result.details.find(({ id }) => id === orderIds[1])?.currencyCode, 'TRY');
      assert.equal(result.details.find(({ id }) => id === orderIds[2])?.currencyCode, 'EUR');
      assert.equal(result.lastSyncAt === null, false);

      assert.equal(result.amounts.find(({ currencyCode }) => currencyCode === 'USD')?.current.realizedAmount, '1000');
      assert.equal(result.amounts.find(({ currencyCode }) => currencyCode === 'USD')?.previous.realizedAmount, '700');
      assert.equal(result.amounts.find(({ currencyCode }) => currencyCode === 'TRY')?.current.openAmount, '800');
      assert.equal(result.amounts.find(({ currencyCode }) => currencyCode === 'EUR')?.current.expiredAmount, '500');
      assert.equal(new Set(result.amounts.map(({ currencyCode }) => currencyCode)).size, result.amounts.length);
      assert.equal('mixedCurrencyTotal' in result, false);

      await assert.rejects(
        queryMonthlyQuotationReportWithAmounts(pool, {
          filters,
          allowedBusinessUnitIds: ['22222222-2222-4222-8222-222222222222'],
        }),
        /REPORT_SCOPE_DENIED/u,
      );
    } finally {
      await pool.query('DELETE FROM odoo_sale_orders WHERE odoo_id = ANY($1::int[])', [orderIds]).catch(() => undefined);
      await pool.query('DELETE FROM odoo_customers WHERE odoo_partner_id = ANY($1::int[])', [customerIds]).catch(() => undefined);
      await pool.query('DELETE FROM odoo_salespeople WHERE odoo_user_id = $1', [salespersonId]).catch(() => undefined);
      await pool.query('DELETE FROM sync_runs WHERE id = $1', [runId]).catch(() => undefined);
      await pool
        .query('DELETE FROM app_meta WHERE key = $1', [getOdooCurrencyCodeMetaKey(euroCurrencyId)])
        .catch(() => undefined);
      await pool.end();
    }
  },
);
