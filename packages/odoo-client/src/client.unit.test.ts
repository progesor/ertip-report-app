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

test('uses the Odoo 19 public version endpoint', async () => {
  let capturedUrl = '';
  const client = createOdooClient(config, {
    fetch: async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ version: '19.0', version_info: [19, 0, 0] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.getVersionInfo();

  assert.equal(capturedUrl, 'https://ertipmedical.odoo.com/web/version');
  assert.equal(result.version, '19.0');
});

test('uses JSON-2 route and required headers without exposing the key in errors', async () => {
  let capturedUrl = '';
  let capturedHeaders: Headers | undefined;

  const client = createOdooClient(config, {
    fetch: async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify(2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.call<number>('res.company', 'search_count', {
    domain: [],
  });

  assert.equal(result, 2);
  assert.equal(capturedUrl, 'https://ertipmedical.odoo.com/json/2/res.company/search_count');
  assert.equal(capturedHeaders?.get('x-odoo-database'), 'ertipmedical');
  assert.equal(capturedHeaders?.get('authorization'), 'bearer super-secret-test-key');
  assert.equal(capturedHeaders?.get('user-agent'), 'ErtipReportApp/0.2');
});

test('classifies authentication failures without leaking the API key', async () => {
  const client = createOdooClient(config, {
    fetch: async () => new Response('{}', { status: 401 }),
  });

  await assert.rejects(
    client.call('res.company', 'search_count', { domain: [] }),
    (error: unknown) => {
      assert.ok(error instanceof OdooClientError);
      assert.equal(error.code, 'AUTHENTICATION_FAILED');
      assert.equal(error.status, 401);
      assert.equal(error.message.includes(config.apiKey), false);
      return true;
    },
  );
});

test('classifies request timeouts separately from other network failures', async () => {
  const client = createOdooClient(config, {
    fetch: async () => {
      const error = new Error('request timed out');
      error.name = 'TimeoutError';
      throw error;
    },
  });

  await assert.rejects(
    client.getVersionInfo(),
    (error: unknown) => error instanceof OdooClientError && error.code === 'TIMEOUT',
  );
});
