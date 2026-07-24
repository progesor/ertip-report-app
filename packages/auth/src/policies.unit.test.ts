import assert from 'node:assert/strict';
import test from 'node:test';

import { can, canAccessBusinessUnit, isAppRole } from './policies.ts';

test('only owner and manager are valid roles', () => {
  assert.equal(isAppRole('owner'), true);
  assert.equal(isAppRole('manager'), true);
  assert.equal(isAppRole('employee'), false);
});

test('manager can run and export reports but cannot administer integrations', () => {
  assert.equal(can('manager', 'reports:read'), true);
  assert.equal(can('manager', 'reports:export'), true);
  assert.equal(can('manager', 'admin:connections'), false);
});

test('business unit scope is server enforceable', () => {
  assert.equal(canAccessBusinessUnit('manager', ['international'], 'international'), true);
  assert.equal(canAccessBusinessUnit('manager', ['international'], 'domestic'), false);
  assert.equal(canAccessBusinessUnit('owner', [], 'domestic'), true);
});
