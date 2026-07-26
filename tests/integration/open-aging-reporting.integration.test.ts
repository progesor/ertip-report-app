import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDatabasePool,
  ensureDatabaseSchema,
  getOdooCurrencyCodeMetaKey,
  queryOpenAgingQuotationReport,
  upsertOdooCurrencyCodes,
} from '@ertip/db';
import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeOpenAgingQuotationReportFilters,
} from '@ertip/reporting';

const connectionString = process.env.DATABASE_URL?.trim();
const domesticBusinessUnitId = '22222222-2222-4222-8222-222222222222';

test(
  'open aging report reconciles PostgreSQL fixture, filters and server scope',
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const pool = createDatabasePool({ connectionString, ssl: false, maxConnections: 2 });
    const runId = randomUUID();
    const salespersonIds = [920_010, 920_020] as const;
    const customerIds = [920_101, 920_102, 920_103] as const;
    const orderIds = [920_001, 920_002, 920_003, 920_004, 920_005, 920_006, 920_007] as const;
    const euroCurrencyId = 990_102;

    try {
      await ensureDatabaseSchema(pool);
      await upsertOdooCurrencyCodes(pool, [{ odooCurrencyId: euroCurrencyId, code: 'EUR' }]);
      await pool.query(
        `INSERT INTO sync_runs (
           id, kind, status, source_count, processed_count, reconciles,
           requested_at, started_at, completed_at, updated_at
         ) VALUES ($1, 'sale_order', 'succeeded', 7, 7, true, now(), now(), now(), now())`,
        [runId],
      );
      await pool.query(
        `INSERT INTO odoo_salespeople (
           odoo_user_id, display_name, active, default_company_id, write_date
         ) VALUES
           ($1, 'Aging Salesperson A', true, 1, now()),
           ($2, 'Aging Salesperson B', true, 1, now())`,
        salespersonIds,
      );
      await pool.query(
        `INSERT INTO odoo_customers (
           odoo_partner_id, display_name, active, customer_rank, write_date
         ) VALUES
           ($1, 'Aging Customer A', true, 1, now()),
           ($2, 'Aging Customer B', true, 1, now()),
           ($3, 'Aging Customer C', true, 1, now())`,
        customerIds,
      );
      await pool.query(
        `INSERT INTO odoo_sale_orders (
           odoo_id, business_unit_id, odoo_company_id, odoo_salesperson_id,
           odoo_partner_id, odoo_currency_id, source_state, create_date,
           date_order, validity_date, amount_total, write_date
         ) VALUES
           ($1, $8, 1, $10, $12, 1, 'draft', '2026-07-24 08:00:00+00', '2026-07-24 08:00:00+00', '2026-08-10', 1000, now()),
           ($2, $8, 1, $10, $13, $15, 'sent', '2026-07-16 08:00:00+00', '2026-07-16 08:00:00+00', '2026-07-28', 900, now()),
           ($3, $8, 1, $11, $14, 31, 'draft', '2026-07-06 08:00:00+00', '2026-07-06 08:00:00+00', '2026-07-20', 75000, now()),
           ($4, $8, 1, NULL, $12, 1, 'draft', '2026-06-16 08:00:00+00', '2026-06-16 08:00:00+00', NULL, 4000, now()),
           ($5, $8, 1, $11, $14, 1, 'sale', '2026-05-17 08:00:00+00', '2026-05-18 08:00:00+00', NULL, 5100, now()),
           ($6, $8, 1, $11, $14, 1, 'cancel', '2026-04-17 08:00:00+00', '2026-04-17 08:00:00+00', NULL, 6100, now()),
           ($7, $9, 25, $10, $12, 31, 'draft', '2026-03-01 08:00:00+00', '2026-03-01 08:00:00+00', '2026-03-10', 88000, now())`,
        [
          ...orderIds,
          INTERNATIONAL_BUSINESS_UNIT_ID,
          domesticBusinessUnitId,
          ...salespersonIds,
          ...customerIds,
          euroCurrencyId,
        ],
      );

      const filters = normalizeOpenAgingQuotationReportFilters({
        request: { businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID },
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
      });
      const result = await queryOpenAgingQuotationReport(pool, {
        filters,
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        generatedAt: new Date('2026-07-26T12:00:00.000Z'),
      });

      assert.equal(result.businessUnit.displayName, 'Yurt Dışı');
      assert.equal(result.metrics.trackedCount, 4);
      assert.equal(result.metrics.currentlyOpenCount, 3);
      assert.equal(result.metrics.overdueCount, 1);
      assert.equal(result.metrics.nearingExpiryCount, 1);
      assert.equal(result.metrics.missingValidityCount, 1);
      assert.equal(result.ageDistribution.find(({ code }) => code === '0_7')?.count, 1);
      assert.equal(result.ageDistribution.find(({ code }) => code === '31_60')?.count, 1);
      assert.equal(result.details.find(({ id }) => id === orderIds[0])?.currencyCode, 'USD');
      assert.equal(result.details.find(({ id }) => id === orderIds[1])?.currencyCode, 'EUR');
      assert.equal(result.details.find(({ id }) => id === orderIds[2])?.currencyCode, 'TRY');
      assert.equal(result.details.some(({ id }) => id === orderIds[6]), false);
      assert.equal(result.lastSyncAt === null, false);

      const filtered = await queryOpenAgingQuotationReport(pool, {
        filters: normalizeOpenAgingQuotationReportFilters({
          request: {
            businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
            salespersonId: salespersonIds[1],
            customerId: customerIds[2],
            validityGroup: 'overdue',
            ageBucket: '15_30',
          },
          allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        }),
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        generatedAt: new Date('2026-07-26T12:00:00.000Z'),
      });
      assert.equal(filtered.detailTotalCount, 1);
      assert.equal(filtered.details[0]?.id, orderIds[2]);

      await assert.rejects(
        queryOpenAgingQuotationReport(pool, {
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
