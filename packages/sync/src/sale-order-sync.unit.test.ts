import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  SaleOrderSyncBatch,
  SaleOrderSyncCounts,
  SaleOrderSyncRun,
} from '@ertip/db';
import type { OdooClient, ReadOnlyOdooMethod } from '@ertip/odoo-client';

import { runSaleOrderSync, type SaleOrderSyncStore } from './sale-order-sync.ts';

function createRun(): SaleOrderSyncRun {
  const now = new Date('2026-07-25T16:30:00.000Z');
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'running',
    requestedBy: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    dateFrom: null,
    dateTo: null,
    cursorSourceId: 0,
    pageSize: 2,
    sourceCount: null,
    processedCount: 0,
    upsertedSalespeople: 0,
    upsertedCustomers: 0,
    upsertedOrders: 0,
    deletedStaleOrders: 0,
    sourceCounts: null,
    localCounts: null,
    reconciles: null,
    safeErrorCode: null,
    errorStage: null,
    requestedAt: now,
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

function containsDomainValue(domain: readonly unknown[], field: string, value: unknown): boolean {
  return domain.some(
    (item) =>
      Array.isArray(item) && item[0] === field && item[1] === '=' && item[2] === value,
  );
}

function createClient(): OdooClient {
  const orders = [
    {
      id: 734,
      company_id: 1,
      user_id: false,
      partner_id: 101,
      currency_id: 1,
      state: 'draft',
      create_date: '2025-05-17 08:22:48',
      date_order: '2025-05-17 08:10:25',
      validity_date: false,
      amount_total: '1250.000000',
      write_date: '2025-05-17 08:22:48',
    },
    {
      id: 6460,
      company_id: 25,
      user_id: 10,
      partner_id: 202,
      currency_id: 31,
      state: 'sale',
      create_date: '2026-06-09 14:02:19',
      date_order: '2026-06-09 14:02:20',
      validity_date: '2026-06-30',
      amount_total: 8400,
      write_date: '2026-06-09 14:02:20',
    },
  ] as const;

  return {
    async getVersionInfo() {
      return { version: '19.0+e' };
    },
    async call<TResult>(
      model: string,
      method: ReadOnlyOdooMethod,
      params: Readonly<Record<string, unknown>> = {},
    ): Promise<TResult> {
      if (model === 'sale.order' && method === 'search_count') {
        const domain = (params.domain as readonly unknown[] | undefined) ?? [];
        const companyId = containsDomainValue(domain, 'company_id', 1)
          ? 1
          : containsDomainValue(domain, 'company_id', 25)
            ? 25
            : null;
        const state = ['draft', 'sent', 'sale', 'cancel'].find((value) =>
          containsDomainValue(domain, 'state', value),
        );
        const missingUser = containsDomainValue(domain, 'user_id', false);
        const filtered = orders.filter(
          (order) =>
            (companyId === null || order.company_id === companyId) &&
            (state === undefined || order.state === state) &&
            (!missingUser || order.user_id === false),
        );
        return filtered.length as TResult;
      }

      if (model === 'sale.order' && method === 'search_read') {
        assert.equal(params.load, null);
        const domain = (params.domain as readonly unknown[] | undefined) ?? [];
        const cursorItem = domain.find(
          (item) => Array.isArray(item) && item[0] === 'id' && item[1] === '>',
        );
        const cursor =
          Array.isArray(cursorItem) && typeof cursorItem[2] === 'number' ? cursorItem[2] : 0;
        return orders.filter(({ id }) => id > cursor) as TResult;
      }

      if (model === 'res.users' && method === 'read') {
        assert.equal(params.load, null);
        return [
          {
            id: 10,
            name: false,
            active: true,
            company_id: 25,
            write_date: '2026-06-09 14:02:20',
          },
        ] as TResult;
      }

      if (model === 'res.partner' && method === 'read') {
        assert.equal(params.load, null);
        return [
          {
            id: 101,
            name: false,
            active: true,
            company_id: false,
            commercial_partner_id: 101,
            customer_rank: '1',
            write_date: '2025-05-17 08:22:48',
          },
        ] as TResult;
      }

      throw new Error(`Unexpected Odoo call: ${model}.${method}`);
    },
  };
}

test('syncs raw relations and preserves nameless or inaccessible references', async () => {
  const run = createRun();
  const batches: SaleOrderSyncBatch[] = [];
  const finalizedCountResults: SaleOrderSyncCounts[] = [];
  let sourceCount = 0;
  const store: SaleOrderSyncStore = {
    async getBusinessUnitMappings() {
      return [
        {
          businessUnitId: '11111111-1111-4111-8111-111111111111',
          code: 'international',
          displayName: 'Yurt Dışı',
          odooCompanyId: 1,
          sourceCurrencyId: 1,
          sourceCurrencyCode: 'USD',
        },
        {
          businessUnitId: '22222222-2222-4222-8222-222222222222',
          code: 'domestic',
          displayName: 'Yurt İçi',
          odooCompanyId: 25,
          sourceCurrencyId: 31,
          sourceCurrencyCode: 'TRY',
        },
      ];
    },
    async setSaleOrderSyncSourceCount(_runId, count) {
      sourceCount = count;
    },
    async applySaleOrderSyncBatch(_runId, batch) {
      batches.push(batch);
    },
    async finalizeSaleOrderSync(_runId, counts) {
      finalizedCountResults.push(counts);
      return {
        run: {
          ...run,
          status: 'succeeded',
          sourceCount: counts.totalCount,
          processedCount: counts.totalCount,
          sourceCounts: counts,
          localCounts: counts,
          reconciles: true,
          completedAt: new Date('2026-07-25T16:31:00.000Z'),
        },
        localCounts: counts,
      };
    },
  };

  const result = await runSaleOrderSync({ client: createClient(), store, run });
  const finalizedCounts = finalizedCountResults[0];
  const batch = batches[0];

  assert.ok(finalizedCounts);
  assert.ok(batch);
  assert.equal(result.status, 'succeeded');
  assert.equal(sourceCount, 2);
  assert.equal(batches.length, 1);
  assert.equal(batch.orders.length, 2);
  assert.equal(batch.customers.length, 2);
  assert.equal(batch.salespeople.length, 1);
  assert.equal(batch.orders.find(({ odooId }) => odooId === 734)?.odooSalespersonId, null);
  assert.equal(batch.orders.find(({ odooId }) => odooId === 734)?.amountTotal, 1250);
  assert.equal(
    batch.orders.find(({ odooId }) => odooId === 734)?.businessUnitId,
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(
    batch.orders.find(({ odooId }) => odooId === 6460)?.businessUnitId,
    '22222222-2222-4222-8222-222222222222',
  );
  assert.equal(batch.customers.find(({ odooPartnerId }) => odooPartnerId === 101)?.customerRank, 1);
  assert.equal(
    batch.customers.find(({ odooPartnerId }) => odooPartnerId === 101)?.displayName,
    'İsimsiz müşteri · Odoo #101',
  );
  assert.equal(
    batch.customers.find(({ odooPartnerId }) => odooPartnerId === 202)?.displayName,
    'Erişilemeyen müşteri · Odoo #202',
  );
  assert.equal(
    batch.salespeople.find(({ odooUserId }) => odooUserId === 10)?.displayName,
    'İsimsiz kullanıcı · Odoo #10',
  );
  assert.equal(finalizedCounts.stateCounts.draft, 1);
  assert.equal(finalizedCounts.stateCounts.sale, 1);
  assert.equal(finalizedCounts.missingSalespersonCount, 1);
});
