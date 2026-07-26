import assert from 'node:assert/strict';
import test from 'node:test';

import { REPORT_CATALOG, REPORT_CATEGORIES } from './report-catalog.ts';

test('report catalog exposes every accepted M5 report exactly once', () => {
  assert.equal(REPORT_CATALOG.length, 5);
  assert.equal(new Set(REPORT_CATALOG.map(({ code }) => code)).size, REPORT_CATALOG.length);
  assert.equal(new Set(REPORT_CATALOG.map(({ href }) => href)).size, REPORT_CATALOG.length);

  assert.deepEqual(
    new Set(REPORT_CATALOG.map(({ href }) => href)),
    new Set([
      '/reports/monthly-quotation-performance',
      '/reports/open-aging-quotations',
      '/reports/customer-quotation-history',
      '/reports/personnel-performance',
      '/reports/quotation-conversion',
    ]),
  );
});

test('report catalog uses only declared categories and complete descriptions', () => {
  for (const report of REPORT_CATALOG) {
    assert.ok(REPORT_CATEGORIES.includes(report.category));
    assert.ok(report.title.length > 5);
    assert.ok(report.description.length > 30);
    assert.ok(report.capabilities.length >= 3);
    assert.ok(report.href.startsWith('/reports/'));
  }
});
