import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCustomerQuotationHistoryReport,
  normalizeCustomerQuotationHistoryFilters,
  type CustomerQuotationHistorySourceRecord,
} from './customer-quotation-history-report.ts';
import {
  buildMonthlyQuotationReport,
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeMonthlyQuotationReportFilters,
} from './monthly-quotation-report.ts';

const generatedAt = new Date('2026-07-26T12:00:00.000Z');
const businessUnit = {
  id: INTERNATIONAL_BUSINESS_UNIT_ID,
  displayName: 'Yurt Dışı',
  currencyCode: 'USD',
} as const;

const records: readonly CustomerQuotationHistorySourceRecord[] = [
  {
    id: 1001,
    state: 'cancel',
    validityDate: null,
    createDate: '2026-01-10T08:00:00.000Z',
    dateOrder: '2026-01-10T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 101,
    customerName: 'Atlas Hospital Group',
    amountTotal: '1200',
    currencyCode: 'USD',
  },
  {
    id: 1002,
    state: 'sale',
    validityDate: null,
    createDate: '2026-02-20T08:00:00.000Z',
    dateOrder: '2026-02-24T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 101,
    customerName: 'Atlas Hospital Group',
    amountTotal: '2500',
    currencyCode: 'EUR',
  },
  {
    id: 1003,
    state: 'draft',
    validityDate: '2026-08-05',
    createDate: '2026-04-01T08:00:00.000Z',
    dateOrder: '2026-04-01T08:00:00.000Z',
    salespersonId: 17,
    salespersonName: 'Mert Demir',
    customerId: 101,
    customerName: 'Atlas Hospital Group',
    amountTotal: '3200',
    currencyCode: 'USD',
  },
  {
    id: 1004,
    state: 'sent',
    validityDate: '2026-06-01',
    createDate: '2026-05-15T08:00:00.000Z',
    dateOrder: '2026-05-15T08:00:00.000Z',
    salespersonId: null,
    salespersonName: 'Atanmamış',
    customerId: 101,
    customerName: 'Atlas Hospital Group',
    amountTotal: '4100',
    currencyCode: 'TRY',
  },
  {
    id: 2001,
    state: 'sale',
    validityDate: null,
    createDate: '2026-03-01T08:00:00.000Z',
    dateOrder: '2026-03-04T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 202,
    customerName: 'Northstar Surgical',
    amountTotal: '900',
    currencyCode: 'USD',
  },
];

function createFilters() {
  return normalizeCustomerQuotationHistoryFilters({
    request: {
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      customerId: 101,
      dateFrom: '2026-01-01',
      dateTo: '2026-07-01',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: generatedAt,
  });
}

test('normalizes required customer and rejects denied scope', () => {
  assert.throws(
    () =>
      normalizeCustomerQuotationHistoryFilters({
        request: { customerId: null },
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        now: generatedAt,
      }),
    /CUSTOMER_REQUIRED/u,
  );

  assert.throws(
    () =>
      normalizeCustomerQuotationHistoryFilters({
        request: {
          businessUnitId: '22222222-2222-4222-8222-222222222222',
          customerId: 101,
        },
        allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
        now: generatedAt,
      }),
    /REPORT_SCOPE_DENIED/u,
  );
});

test('builds deterministic customer timeline, repeat cadence and status transitions', () => {
  const report = buildCustomerQuotationHistoryReport({
    records,
    filters: createFilters(),
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-26T10:00:00.000Z',
  });

  assert.equal(report.customer.displayName, 'Atlas Hospital Group');
  assert.equal(report.metrics.quotationCount, 4);
  assert.equal(report.metrics.realizedCount, 1);
  assert.equal(report.metrics.openCount, 1);
  assert.equal(report.metrics.notRealizedCount, 2);
  assert.equal(report.allTime.quotationCount, 4);
  assert.equal(report.repeat.repeatQuotationCount, 3);
  assert.equal(report.repeat.activeMonthCount, 4);
  assert.deepEqual(
    report.timeline.map(({ id }) => id),
    [1004, 1003, 1002, 1001],
  );
  assert.deepEqual(
    report.transitions.map(({ from, to, count }) => ({ from, to, count })),
    [
      { from: 'cancelled', to: 'realized', count: 1 },
      { from: 'open', to: 'expired', count: 1 },
      { from: 'realized', to: 'open', count: 1 },
    ],
  );
  assert.deepEqual(
    report.currencies.map(({ currencyCode, quotationCount }) => ({ currencyCode, quotationCount })),
    [
      { currencyCode: 'USD', quotationCount: 2 },
      { currencyCode: 'EUR', quotationCount: 1 },
      { currencyCode: 'TRY', quotationCount: 1 },
    ],
  );
  assert.equal(report.salespersonHistory.length, 3);
  assert.equal(report.scope.serverEnforced, true);
});

test('reconciles customer metrics with the canonical monthly report for identical filters', () => {
  const customerFilters = createFilters();
  const customerReport = buildCustomerQuotationHistoryReport({
    records,
    filters: customerFilters,
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: null,
  });
  const monthlyFilters = normalizeMonthlyQuotationReportFilters({
    request: {
      businessUnitId: customerFilters.businessUnitId,
      customerId: customerFilters.customerId,
      dateFrom: customerFilters.dateFrom,
      dateTo: customerFilters.dateTo,
      status: customerFilters.status,
      view: 'customer',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: generatedAt,
  });
  const monthlyReport = buildMonthlyQuotationReport({
    records,
    filters: monthlyFilters,
    businessUnit,
    businessUnits: [businessUnit],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: null,
  });

  assert.deepEqual(customerReport.metrics, monthlyReport.metrics);
  assert.equal(customerReport.timelineTotalCount, monthlyReport.detailTotalCount);
});
