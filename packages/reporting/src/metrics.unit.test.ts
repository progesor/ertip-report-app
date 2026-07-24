import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateQuotationMetrics, normalizeQuotationStatus } from './metrics.ts';

const asOfDate = new Date('2026-07-24T12:00:00.000Z');

test('normalizes Odoo quotation states with expiry semantics', () => {
  assert.equal(normalizeQuotationStatus({ state: 'sale' }, asOfDate), 'realized');
  assert.equal(normalizeQuotationStatus({ state: 'cancel' }, asOfDate), 'cancelled');
  assert.equal(
    normalizeQuotationStatus({ state: 'draft', validityDate: '2026-07-01' }, asOfDate),
    'expired',
  );
  assert.equal(
    normalizeQuotationStatus({ state: 'sent', validityDate: '2026-07-30' }, asOfDate),
    'open',
  );
  assert.equal(normalizeQuotationStatus({ state: 'custom_state' }, asOfDate), 'unknown');
});

test('deduplicates sale orders by ID and calculates canonical KPI values', () => {
  const metrics = calculateQuotationMetrics(
    [
      { id: 1, state: 'sale', customerId: 10 },
      { id: 1, state: 'sale', customerId: 10 },
      { id: 2, state: 'draft', validityDate: '2026-07-30', customerId: 11 },
      { id: 3, state: 'sent', validityDate: '2026-07-01', customerId: 11 },
      { id: 4, state: 'cancel', customerId: null },
    ],
    asOfDate,
  );

  assert.deepEqual(metrics, {
    quotationCount: 4,
    realizedCount: 1,
    openCount: 1,
    expiredCount: 1,
    cancelledCount: 1,
    notRealizedCount: 2,
    unknownCount: 0,
    quotedCustomerCount: 2,
    conversionRate: 0.25,
  });
});
