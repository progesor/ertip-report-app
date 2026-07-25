import assert from 'node:assert/strict';
import test from 'node:test';

import { OdooClientError, type OdooClient, type ReadOnlyOdooMethod } from './client.ts';
import { discoverSaleOrderCoverage } from './coverage.ts';

type Domain = readonly (readonly unknown[])[];

function domainKey(params: Readonly<Record<string, unknown>> | undefined): string {
  return JSON.stringify((params?.domain as Domain | undefined) ?? []);
}

test('reconciles global and company state totals and exposes safe unassigned metadata', async () => {
  const attempts = new Map<string, number>();
  const counts: Readonly<Record<string, number>> = {
    '[]': 6875,
    '[["state","=","draft"]]': 1088,
    '[["state","=","sent"]]': 1,
    '[["state","=","sale"]]': 5717,
    '[["state","=","cancel"]]': 69,
    '[["user_id","=",false]]': 2,
    '[["company_id","=",1]]': 5800,
    '[["company_id","=",1],["state","=","draft"]]': 900,
    '[["company_id","=",1],["state","=","sent"]]': 1,
    '[["company_id","=",1],["state","=","sale"]]': 4840,
    '[["company_id","=",1],["state","=","cancel"]]': 59,
    '[["company_id","=",1],["user_id","=",false]]': 1,
    '[["company_id","=",25]]': 1075,
    '[["company_id","=",25],["state","=","draft"]]': 188,
    '[["company_id","=",25],["state","=","sent"]]': 0,
    '[["company_id","=",25],["state","=","sale"]]': 877,
    '[["company_id","=",25],["state","=","cancel"]]': 10,
    '[["company_id","=",25],["user_id","=",false]]': 1,
  };
  const client: OdooClient = {
    async getVersionInfo() {
      return { version: '19.0+e' };
    },
    async call<TResult>(
      model: string,
      method: ReadOnlyOdooMethod,
      params?: Readonly<Record<string, unknown>>,
    ): Promise<TResult> {
      if (model === 'res.company' && method === 'search_read') {
        return [
          { id: 1, name: 'Ertip Export' },
          { id: 25, name: 'Ertip Domestic' },
        ] as TResult;
      }

      if (model === 'sale.order' && method === 'fields_get') {
        return {
          state: {
            selection: [
              ['draft', 'Quotation'],
              ['sent', 'Quotation Sent'],
              ['sale', 'Sales Order'],
              ['cancel', 'Cancelled'],
            ],
          },
        } as TResult;
      }

      if (model === 'sale.order' && method === 'search_read') {
        return [
          {
            id: 7101,
            company_id: [1, 'Ertip Export'],
            state: 'draft',
            create_date: '2026-07-20 09:00:00',
            date_order: '2026-07-20 09:00:00',
          },
          {
            id: 7102,
            company_id: [25, 'Ertip Domestic'],
            state: 'sale',
            create_date: '2026-06-28 10:00:00',
            date_order: '2026-07-03 12:00:00',
          },
        ] as TResult;
      }

      if (model === 'sale.order' && method === 'search_count') {
        const key = domainKey(params);
        const attempt = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, attempt);

        if (key === '[["company_id","=",25],["state","=","sale"]]' && attempt === 1) {
          throw new OdooClientError('temporary outage', {
            status: 503,
            code: 'ODOO_UNAVAILABLE',
          });
        }

        const value = counts[key];

        if (value === undefined) {
          throw new Error(`Unexpected count domain: ${key}`);
        }

        return value as TResult;
      }

      throw new Error(`Unexpected Odoo call: ${model}/${method}`);
    },
  };

  const result = await discoverSaleOrderCoverage(client);

  assert.equal(result.totalCount, 6875);
  assert.equal(result.reconcilesTotal, true);
  assert.equal(result.missingSalespersonCount, 2);
  assert.equal(result.companyCoverage.length, 2);
  assert.equal(result.companyCoverage[0]?.companyId, 1);
  assert.equal(result.companyCoverage[0]?.reconcilesTotal, true);
  assert.equal(result.companyCoverage[1]?.companyId, 25);
  assert.equal(result.companyCoverage[1]?.reconcilesTotal, true);
  assert.equal(result.companyCoverage[1]?.missingSalespersonCount, 1);
  assert.equal(result.unassignedSamples.length, 2);
  assert.deepEqual(result.unassignedSamples[0], {
    id: 7101,
    companyId: 1,
    state: 'draft',
    createDate: '2026-07-20 09:00:00',
    dateOrder: '2026-07-20 09:00:00',
  });
  assert.equal(attempts.get('[["company_id","=",25],["state","=","sale"]]'), 2);
});
