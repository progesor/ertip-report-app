import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOpenAgingQuotationReport,
  getOpenAgingBucket,
  getOpenAgingValidityGroup,
  normalizeOpenAgingQuotationReportFilters,
  OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID,
  type OpenAgingQuotationSourceRecord,
} from './open-aging-quotation-report.ts';

const businessUnit = {
  id: OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID,
  displayName: 'Yurt Dışı',
  currencyCode: 'USD',
} as const;

const records: readonly OpenAgingQuotationSourceRecord[] = [
  {
    id: 1,
    state: 'draft',
    validityDate: '2026-08-10',
    createDate: '2026-07-24T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 101,
    customerName: 'Atlas Hospital',
    amountTotal: '1000',
    currencyCode: 'USD',
  },
  {
    id: 2,
    state: 'sent',
    validityDate: '2026-07-28',
    createDate: '2026-07-16T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 102,
    customerName: 'Northstar Surgical',
    amountTotal: '900',
    currencyCode: 'EUR',
  },
  {
    id: 3,
    state: 'draft',
    validityDate: '2026-07-20',
    createDate: '2026-07-06T08:00:00.000Z',
    salespersonId: 17,
    salespersonName: 'Mert Demir',
    customerId: 103,
    customerName: 'Medline Europe',
    amountTotal: '75000',
    currencyCode: 'TRY',
  },
  {
    id: 4,
    state: 'draft',
    validityDate: null,
    createDate: '2026-06-16T08:00:00.000Z',
    salespersonId: null,
    salespersonName: 'Atanmamış',
    customerId: 104,
    customerName: 'Nova Clinic',
    amountTotal: '4000',
    currencyCode: 'USD',
  },
  {
    id: 5,
    state: 'sent',
    validityDate: '2026-09-01',
    createDate: '2026-05-17T08:00:00.000Z',
    salespersonId: 18,
    salespersonName: 'Selin Kaya',
    customerId: 105,
    customerName: 'Orion Healthcare',
    amountTotal: '5100',
    currencyCode: 'EUR',
  },
  {
    id: 6,
    state: 'draft',
    validityDate: '2026-07-26',
    createDate: '2026-04-17T08:00:00.000Z',
    salespersonId: 18,
    salespersonName: 'Selin Kaya',
    customerId: 105,
    customerName: 'Orion Healthcare',
    amountTotal: '6100',
    currencyCode: 'USD',
  },
  {
    id: 7,
    state: 'sale',
    validityDate: null,
    createDate: '2026-07-20T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 101,
    customerName: 'Atlas Hospital',
    amountTotal: '2000',
    currencyCode: 'USD',
  },
];

test('classifies canonical age and validity buckets', () => {
  assert.equal(getOpenAgingBucket(0), '0_7');
  assert.equal(getOpenAgingBucket(8), '8_14');
  assert.equal(getOpenAgingBucket(15), '15_30');
  assert.equal(getOpenAgingBucket(31), '31_60');
  assert.equal(getOpenAgingBucket(61), '61_90');
  assert.equal(getOpenAgingBucket(91), '90_plus');
  assert.deepEqual(getOpenAgingValidityGroup(null, '2026-07-26'), {
    group: 'missing',
    daysToExpiry: null,
  });
  assert.deepEqual(getOpenAgingValidityGroup('2026-07-20', '2026-07-26'), {
    group: 'overdue',
    daysToExpiry: -6,
  });
  assert.deepEqual(getOpenAgingValidityGroup('2026-07-28', '2026-07-26'), {
    group: 'nearing_expiry',
    daysToExpiry: 2,
  });
  assert.deepEqual(getOpenAgingValidityGroup('2026-08-10', '2026-07-26'), {
    group: 'valid',
    daysToExpiry: 15,
  });
});

test('builds one scoped open-aging result with ownership and source currencies', () => {
  const filters = normalizeOpenAgingQuotationReportFilters({
    request: {},
    allowedBusinessUnitIds: [OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID],
  });
  const result = buildOpenAgingQuotationReport({
    records,
    filters,
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID],
    generatedAt: '2026-07-26T12:00:00.000Z',
    lastSyncAt: '2026-07-26T11:00:00.000Z',
  });

  assert.equal(result.metrics.trackedCount, 6);
  assert.equal(result.metrics.currentlyOpenCount, 5);
  assert.equal(result.metrics.overdueCount, 1);
  assert.equal(result.metrics.nearingExpiryCount, 2);
  assert.equal(result.metrics.missingValidityCount, 1);
  assert.equal(result.metrics.customerCount, 5);
  assert.equal(result.metrics.salespersonCount, 4);
  assert.equal(result.metrics.oldestAgeDays, 100);
  assert.deepEqual(result.ageDistribution.map(({ count }) => count), [1, 1, 1, 1, 1, 1]);
  assert.equal(result.validityDistribution.find(({ code }) => code === 'valid')?.count, 2);
  assert.equal(result.salespeople[0]?.displayName, 'Mert Demir');
  assert.equal(result.customers.find(({ customerId }) => customerId === 105)?.metrics.trackedCount, 2);
  assert.equal(result.details.find(({ id }) => id === 2)?.currencyCode, 'EUR');
  assert.equal(result.details.find(({ id }) => id === 3)?.currencyCode, 'TRY');
  assert.deepEqual(result.scope, {
    businessUnitIds: [OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID],
    serverEnforced: true,
  });
});

test('applies combined age, validity and dimension filters deterministically', () => {
  const filters = normalizeOpenAgingQuotationReportFilters({
    request: {
      salespersonId: 18,
      customerId: 105,
      ageBucket: '90_plus',
      validityGroup: 'nearing_expiry',
    },
    allowedBusinessUnitIds: [OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID],
  });
  const result = buildOpenAgingQuotationReport({
    records,
    filters,
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID],
    generatedAt: '2026-07-26T12:00:00.000Z',
    lastSyncAt: null,
  });

  assert.equal(result.metrics.trackedCount, 1);
  assert.equal(result.details[0]?.id, 6);
  assert.equal(result.details[0]?.daysToExpiry, 0);
});

test('rejects a requested business unit outside the server session scope', () => {
  assert.throws(
    () =>
      normalizeOpenAgingQuotationReportFilters({
        request: { businessUnitId: '22222222-2222-4222-8222-222222222222' },
        allowedBusinessUnitIds: [OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID],
      }),
    /REPORT_SCOPE_DENIED/u,
  );
});
