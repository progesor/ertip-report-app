import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { assertSameOrigin, RequestSecurityError } from './security.ts';

const originalPublicUrl = process.env.APP_PUBLIC_URL;

afterEach(() => {
  if (originalPublicUrl === undefined) {
    delete process.env.APP_PUBLIC_URL;
  } else {
    process.env.APP_PUBLIC_URL = originalPublicUrl;
  }
});

test('accepts the configured public origin even when proxy headers contain an internal host', () => {
  process.env.APP_PUBLIC_URL = 'https://report.progesor.net/';
  const request = new Request('http://internal-app:3000/api/auth/bootstrap', {
    method: 'POST',
    headers: {
      origin: 'https://report.progesor.net',
      host: 'internal-app:3000',
      'x-forwarded-host': 'internal-app',
      'x-forwarded-proto': 'http',
    },
  });

  assert.doesNotThrow(() => assertSameOrigin(request));
});

test('rejects an origin that differs from the configured public origin', () => {
  process.env.APP_PUBLIC_URL = 'https://report.progesor.net';
  const request = new Request('http://internal-app:3000/api/auth/bootstrap', {
    method: 'POST',
    headers: {
      origin: 'https://attacker.example',
      'x-forwarded-host': 'internal-app',
      'x-forwarded-proto': 'http',
    },
  });

  assert.throws(() => assertSameOrigin(request), RequestSecurityError);
});

test('falls back to forwarded proxy headers when no public origin is configured', () => {
  delete process.env.APP_PUBLIC_URL;
  const request = new Request('http://internal-app:3000/api/auth/bootstrap', {
    method: 'POST',
    headers: {
      origin: 'https://report.progesor.net',
      'x-forwarded-host': 'report.progesor.net',
      'x-forwarded-proto': 'https',
    },
  });

  assert.doesNotThrow(() => assertSameOrigin(request));
});
