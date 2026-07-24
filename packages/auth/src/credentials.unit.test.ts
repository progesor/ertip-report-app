import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSessionToken,
  hashClientIdentifier,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  secureCompareSecrets,
  validatePassword,
  verifyPassword,
} from './credentials.ts';

test('password hashes verify only the original password', async () => {
  const encodedHash = await hashPassword('StrongPassword2026');

  assert.equal(await verifyPassword('StrongPassword2026', encodedHash), true);
  assert.equal(await verifyPassword('WrongPassword2026', encodedHash), false);
  assert.equal(await verifyPassword('StrongPassword2026', 'invalid-hash'), false);
});

test('password policy requires a long mixed password', () => {
  assert.deepEqual(validatePassword('StrongPassword2026'), []);
  assert.ok(validatePassword('short').length >= 3);
});

test('session tokens are opaque and hashed with the runtime secret', () => {
  const token = createSessionToken();
  const firstHash = hashSessionToken(token, 'session-secret-value');
  const secondHash = hashSessionToken(token, 'session-secret-value');

  assert.ok(token.length >= 40);
  assert.equal(firstHash, secondHash);
  assert.notEqual(firstHash, hashSessionToken(token, 'another-secret'));
  assert.equal(hashClientIdentifier('127.0.0.1', 'session-secret-value').length, 64);
});

test('bootstrap secret comparison and email normalization are deterministic', () => {
  assert.equal(secureCompareSecrets('token', 'token', 'pepper'), true);
  assert.equal(secureCompareSecrets('token', 'different', 'pepper'), false);
  assert.equal(normalizeEmail('  OWNER@EXAMPLE.COM '), 'owner@example.com');
});
