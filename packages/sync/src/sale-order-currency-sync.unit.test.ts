import assert from 'node:assert/strict';
import test from 'node:test';

import type { OdooClient, ReadOnlyOdooMethod } from '@ertip/odoo-client';

import { readOdooCurrencyCodes } from './sale-order-sync-with-currencies.ts';

test('reads active and archived Odoo currency codes without exposing invalid records', async () => {
  const client: OdooClient = {
    async getVersionInfo() {
      return { version: '19.0+e' };
    },
    async call<TResult>(
      model: string,
      method: ReadOnlyOdooMethod,
      params: Readonly<Record<string, unknown>> = {},
    ): Promise<TResult> {
      assert.equal(model, 'res.currency');
      assert.equal(method, 'search_read');
      assert.deepEqual(params.context, { active_test: false });
      assert.equal(params.load, null);
      return [
        { id: 1, name: 'USD' },
        { id: 2, name: 'eur' },
        { id: 31, name: 'TRY' },
        { id: 0, name: 'BAD' },
        { id: 44, name: 'INVALID' },
      ] as TResult;
    },
  };

  assert.deepEqual(await readOdooCurrencyCodes(client), [
    { odooCurrencyId: 1, code: 'USD' },
    { odooCurrencyId: 2, code: 'EUR' },
    { odooCurrencyId: 31, code: 'TRY' },
  ]);
});
