import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { createOdooClient } from '../../packages/odoo-client/src/client.ts';

test('JSON-2 client integrates with an HTTP boundary using read-only requests', async (context) => {
  const requests: Array<{
    url: string;
    method: string;
    database: string | undefined;
    authorization: string | undefined;
    body: string;
  }> = [];

  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      requests.push({
        url: request.url ?? '',
        method: request.method ?? '',
        database: request.headers['x-odoo-database'] as string | undefined,
        authorization: request.headers.authorization,
        body,
      });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify([{ id: 7, name: 'International Company' }]));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => {
    server.close();
  });

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, 'object');
  if (typeof address !== 'object' || address === null) {
    throw new Error('Test server did not expose a TCP address.');
  }

  const client = createOdooClient({
    baseUrl: `http://127.0.0.1:${address.port}`,
    database: 'ertipmedical',
    apiKey: 'integration-secret',
  });

  const companies = await client.call<Array<{ id: number; name: string }>>(
    'res.company',
    'search_read',
    { domain: [], fields: ['id', 'name'], order: 'id asc' },
  );

  assert.deepEqual(companies, [{ id: 7, name: 'International Company' }]);
  assert.deepEqual(requests, [
    {
      url: '/json/2/res.company/search_read',
      method: 'POST',
      database: 'ertipmedical',
      authorization: 'bearer integration-secret',
      body: JSON.stringify({ domain: [], fields: ['id', 'name'], order: 'id asc' }),
    },
  ]);
});
