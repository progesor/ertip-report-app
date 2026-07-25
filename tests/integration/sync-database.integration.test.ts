import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDatabasePool,
  SyncDatabase,
  type SaleOrderSyncCounts,
} from '@ertip/db';

const connectionString = process.env.DATABASE_URL?.trim();

function createCounts(input: {
  readonly total: number;
  readonly draft: number;
  readonly sale: number;
  readonly companyId: number;
  readonly missingSalesperson: number;
}): SaleOrderSyncCounts {
  return {
    totalCount: input.total,
    stateCounts: {
      draft: input.draft,
      sent: 0,
      sale: input.sale,
      cancel: 0,
    },
    missingSalespersonCount: input.missingSalesperson,
    companyCounts: [
      {
        companyId: input.companyId,
        totalCount: input.total,
        stateCounts: {
          draft: input.draft,
          sent: 0,
          sale: input.sale,
          cancel: 0,
        },
        missingSalespersonCount: input.missingSalesperson,
      },
    ],
  };
}

test(
  'durable sync queue upserts idempotently and removes stale rows only on finalize',
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const pool = createDatabasePool({ connectionString, ssl: false, maxConnections: 2 });
    const database = new SyncDatabase(pool);
    const ownerId = randomUUID();

    try {
      await database.migrate();
      await pool.query(
        `INSERT INTO users (id, email, display_name, password_hash, role)
         VALUES ($1, $2, 'Sync Test Owner', 'not-used', 'owner')`,
        [ownerId, `sync-${ownerId}@example.test`],
      );

      const firstQueued = await database.queueSaleOrderSync({
        requestedBy: ownerId,
        dateFrom: null,
        dateTo: null,
        pageSize: 100,
      });
      assert.equal(firstQueued.created, true);
      const firstRun = await database.claimNextSaleOrderSync();
      assert.ok(firstRun);
      await database.setSaleOrderSyncSourceCount(firstRun.id, 2);
      await database.applySaleOrderSyncBatch(
        firstRun.id,
        {
          salespeople: [
            {
              odooUserId: 10,
              displayName: 'Ecem Aygül',
              active: true,
              defaultCompanyId: 25,
              writeDate: '2026-06-09 14:02:20',
            },
          ],
          customers: [
            {
              odooPartnerId: 101,
              displayName: 'Customer A',
              active: true,
              companyId: null,
              commercialPartnerId: 101,
              customerRank: 1,
              writeDate: '2025-05-17 08:22:48',
            },
            {
              odooPartnerId: 202,
              displayName: 'Customer B',
              active: true,
              companyId: 25,
              commercialPartnerId: 202,
              customerRank: 1,
              writeDate: '2026-06-09 14:02:20',
            },
          ],
          orders: [
            {
              odooId: 734,
              businessUnitId: '11111111-1111-4111-8111-111111111111',
              odooCompanyId: 1,
              odooSalespersonId: null,
              odooPartnerId: 101,
              odooCurrencyId: 1,
              sourceState: 'draft',
              createDate: '2025-05-17 08:22:48',
              dateOrder: '2025-05-17 08:10:25',
              validityDate: null,
              amountTotal: 1250,
              writeDate: '2025-05-17 08:22:48',
            },
            {
              odooId: 6460,
              businessUnitId: '22222222-2222-4222-8222-222222222222',
              odooCompanyId: 25,
              odooSalespersonId: 10,
              odooPartnerId: 202,
              odooCurrencyId: 31,
              sourceState: 'sale',
              createDate: '2026-06-09 14:02:19',
              dateOrder: '2026-06-09 14:02:20',
              validityDate: '2026-06-30',
              amountTotal: 8400,
              writeDate: '2026-06-09 14:02:20',
            },
          ],
        },
        6460,
      );
      const firstCounts: SaleOrderSyncCounts = {
        totalCount: 2,
        stateCounts: { draft: 1, sent: 0, sale: 1, cancel: 0 },
        missingSalespersonCount: 1,
        companyCounts: [
          {
            companyId: 1,
            totalCount: 1,
            stateCounts: { draft: 1, sent: 0, sale: 0, cancel: 0 },
            missingSalespersonCount: 1,
          },
          {
            companyId: 25,
            totalCount: 1,
            stateCounts: { draft: 0, sent: 0, sale: 1, cancel: 0 },
            missingSalespersonCount: 0,
          },
        ],
      };
      const firstFinalized = await database.finalizeSaleOrderSync(firstRun.id, firstCounts);
      assert.equal(firstFinalized.run.status, 'succeeded');
      assert.equal(firstFinalized.run.reconciles, true);
      assert.equal(firstFinalized.run.deletedStaleOrders, 0);

      const secondQueued = await database.queueSaleOrderSync({
        requestedBy: ownerId,
        dateFrom: null,
        dateTo: null,
        pageSize: 100,
      });
      assert.equal(secondQueued.created, true);
      const secondRun = await database.claimNextSaleOrderSync();
      assert.ok(secondRun);
      await database.setSaleOrderSyncSourceCount(secondRun.id, 1);
      await database.applySaleOrderSyncBatch(
        secondRun.id,
        {
          salespeople: [],
          customers: [
            {
              odooPartnerId: 101,
              displayName: 'Customer A',
              active: true,
              companyId: null,
              commercialPartnerId: 101,
              customerRank: 1,
              writeDate: '2026-07-01 10:00:00',
            },
          ],
          orders: [
            {
              odooId: 734,
              businessUnitId: '11111111-1111-4111-8111-111111111111',
              odooCompanyId: 1,
              odooSalespersonId: null,
              odooPartnerId: 101,
              odooCurrencyId: 1,
              sourceState: 'sale',
              createDate: '2025-05-17 08:22:48',
              dateOrder: '2025-05-18 09:00:00',
              validityDate: null,
              amountTotal: 1250,
              writeDate: '2026-07-01 10:00:00',
            },
          ],
        },
        734,
      );
      const secondFinalized = await database.finalizeSaleOrderSync(
        secondRun.id,
        createCounts({
          total: 1,
          draft: 0,
          sale: 1,
          companyId: 1,
          missingSalesperson: 1,
        }),
      );
      assert.equal(secondFinalized.run.status, 'succeeded');
      assert.equal(secondFinalized.run.deletedStaleOrders, 1);
      assert.equal(secondFinalized.localCounts.totalCount, 1);
      assert.equal(secondFinalized.localCounts.stateCounts.sale, 1);
      assert.equal(secondFinalized.localCounts.missingSalespersonCount, 1);

      const storedOrders = await pool.query<{
        readonly odoo_id: number;
        readonly source_state: string;
        readonly odoo_salesperson_id: number | null;
      }>(
        `SELECT odoo_id, source_state, odoo_salesperson_id
         FROM odoo_sale_orders
         ORDER BY odoo_id`,
      );
      assert.deepEqual(storedOrders.rows, [
        { odoo_id: 734, source_state: 'sale', odoo_salesperson_id: null },
      ]);
    } finally {
      await pool.query('DELETE FROM sync_runs WHERE requested_by = $1', [ownerId]).catch(() => undefined);
      await pool.query('DELETE FROM users WHERE id = $1', [ownerId]).catch(() => undefined);
      await database.close();
    }
  },
);
