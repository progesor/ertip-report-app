import assert from 'node:assert/strict';
import test from 'node:test';

import { OdooClientError, type OdooClient, type ReadOnlyOdooMethod } from './client.ts';
import { repairTenantDiscoveryStateCounts } from './discovery-resilient.ts';
import type { TenantDiscoveryResult } from './discovery.ts';

function createResult(): TenantDiscoveryResult {
  return {
    generatedAt: '2026-07-25T15:29:19.000Z',
    serverVersion: '19.0+e',
    serverSeries: '19.0',
    protocolVersion: 1,
    companies: [],
    accessibleCompanyIds: [1, 25],
    multiCompanyReadable: true,
    integrationUserCandidates: [],
    models: [],
    saleOrder: {
      totalCount: 6875,
      stateCounts: [
        { value: 'draft', label: 'Quotation', count: 1088 },
        { value: 'sent', label: 'Quotation Sent', count: null },
        { value: 'sale', label: 'Sales Order', count: null },
        { value: 'cancel', label: 'Cancelled', count: 69 },
      ],
      missingValueCounts: [],
      customFieldCount: 0,
      dateSemantics: {
        openSampleCount: 100,
        confirmedSampleCount: 100,
        confirmedDateOrderAfterCreateCount: 55,
        confirmedCrossMonthCount: 4,
        maxObservedLagDays: 147.86,
        evidenceRecordIds: [],
        recommendedCohortField: 'create_date',
      },
    },
  };
}

test('retries transient missing state counts sequentially and preserves completed counts', async () => {
  const attempts = new Map<string, number>();
  const client: OdooClient = {
    async getVersionInfo() {
      return { version: '19.0+e' };
    },
    async call<TResult>(
      model: string,
      method: ReadOnlyOdooMethod,
      params?: Readonly<Record<string, unknown>>,
    ): Promise<TResult> {
      assert.equal(model, 'sale.order');
      assert.equal(method, 'search_count');
      const state = String((params?.domain as readonly (readonly unknown[])[] | undefined)?.[0]?.[2]);
      const attempt = (attempts.get(state) ?? 0) + 1;
      attempts.set(state, attempt);

      if (state === 'sent' && attempt === 1) {
        throw new OdooClientError('temporarily unavailable', {
          status: 503,
          code: 'ODOO_UNAVAILABLE',
        });
      }

      if (state === 'sale') {
        throw new OdooClientError('denied', { status: 403, code: 'ACCESS_DENIED' });
      }

      return 27 as TResult;
    },
  };

  const repaired = await repairTenantDiscoveryStateCounts(client, createResult());

  assert.equal(repaired.find(({ value }) => value === 'draft')?.count, 1088);
  assert.equal(repaired.find(({ value }) => value === 'sent')?.count, 27);
  assert.equal(repaired.find(({ value }) => value === 'sale')?.count, null);
  assert.equal(repaired.find(({ value }) => value === 'cancel')?.count, 69);
  assert.equal(attempts.has('draft'), false);
  assert.equal(attempts.get('sent'), 2);
  assert.equal(attempts.get('sale'), 1);
  assert.equal(attempts.has('cancel'), false);
});
