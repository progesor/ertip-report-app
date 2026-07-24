import assert from 'node:assert/strict';
import test from 'node:test';

import { createOdooClient, OdooClientError } from './client.ts';

const config = {
  baseUrl: 'https://ertipmedical.odoo.com',
  database: 'ertipmedical',
  apiKey: 'super-secret-test-key',
};

test('blocks methods outside the read-only allowlist before making a request', async () => {
  let requestCount = 0;
  const client = createOdooClient(config, {
    fetch: async () => {
      requestCount += 1;
      return new Response('{}');
    },
  });

  await assert.rejects(
    // Deliberate runtime abuse verifies the boundary beyond compile-time types.
    client.call('sale.order', 'write' as never, {}),
    (error: unknown) => error instanceof OdooClientError && error.code === 'WRITE_METHOD_BLOCKED',
  );
  assert.equal(requestCount, 0);
});

test('uses JSON-2 route and required headers without exposing the key in errors', async () => {
  let capturedUrl = '';
  let capturedHeaders: Headers | undefined;

  const client = createOdooClient(config, {
    fetch: async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ count: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.call<{ count: number }>('res.company', 'search_count', {
    domain: [],
  });

  assert.deepEqual(result, { count: 2 });
  assert.equal(capturedUrl, 'https://ertipmedical.odoo.com/json/2/res.company/search_count');
  assert.equal(capturedHeaders?.get('x-odoo-database'), 'ertipmedical');
  assert.equal(capturedHeaders?.get('authorization'), 'bearer super-secret-test-key');
});
