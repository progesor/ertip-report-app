import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMonthlyQuotationReport,
  getDefaultMonthlyReportPeriod,
  getMonthlyQuotationReportDataWindow,
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeMonthlyQuotationReportFilters,
  type MonthlyQuotationSourceRecord,
} from './monthly-quotation-report.ts';

const records: readonly MonthlyQuotationSourceRecord[] = [
  {
    id: 1,
    state: 'sale',
    validityDate: '2026-07-10',
    customerId: 101,
    customerName: 'Alpha Sağlık',
    salespersonId: 10,
    salespersonName: 'Ayşe Satış',
    createDate: '2026-07-03T08:00:00.000Z',
    dateOrder: '2026-07-05T09:00:00.000Z',
    amountTotal: '1000.000000',
    currencyCode: 'USD',
  },
  {
    id: 2,
    state: 'draft',
    validityDate: null,
    customerId: 101,
    customerName: 'Alpha Sağlık',
    salespersonId: null,
    salespersonName: 'Atanmamış',
    createDate: '2026-07-08T08:00:00.000Z',
    dateOrder: '2026-07-08T08:00:00.000Z',
    amountTotal: '800.000000',
    currencyCode: 'USD',
  },
  {
    id: 3,
    state: 'draft',
    validityDate: '2026-07-12',
    customerId: 202,
    customerName: 'Beta Medikal',
    salespersonId: 10,
    salespersonName: 'Ayşe Satış',
    createDate: '2026-07-10T08:00:00.000Z',
    dateOrder: '2026-07-10T08:00:00.000Z',
    amountTotal: '500.000000',
    currencyCode: 'USD',
  },
  {
    id: 4,
    state: 'cancel',
    validityDate: null,
    customerId: 303,
    customerName: 'Gamma Klinik',
    salespersonId: 11,
    salespersonName: 'Bora Satış',
    createDate: '2026-07-15T08:00:00.000Z',
    dateOrder: '2026-07-15T08:00:00.000Z',
    amountTotal: '250.000000',
    currencyCode: 'USD',
  },
  {
    id: 5,
    state: 'sale',
    validityDate: null,
    customerId: 101,
    customerName: 'Alpha Sağlık',
    salespersonId: 10,
    salespersonName: 'Ayşe Satış',
    createDate: '2026-06-09T08:00:00.000Z',
    dateOrder: '2026-06-12T08:00:00.000Z',
    amountTotal: '700.000000',
    currencyCode: 'USD',
  },
];

test('normalizes report filters with Yurt Dışı and current Istanbul month defaults', () => {
  const period = getDefaultMonthlyReportPeriod(new Date('2026-07-25T21:30:00.000Z'));
  assert.deepEqual(period, { dateFrom: '2026-07-01', dateTo: '2026-08-01' });

  const filters = normalizeMonthlyQuotationReportFilters({
    request: {},
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: new Date('2026-07-25T21:30:00.000Z'),
  });

  assert.equal(filters.businessUnitId, INTERNATIONAL_BUSINESS_UNIT_ID);
  assert.equal(filters.dateFrom, '2026-07-01');
  assert.equal(filters.dateTo, '2026-08-01');
  assert.equal(filters.status, 'all');
  assert.equal(filters.view, 'general');
});

test('builds KPI, previous-period, trend, salesperson, customer and detail results', () => {
  const filters = normalizeMonthlyQuotationReportFilters({
    request: {
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: new Date('2026-07-25T12:00:00.000Z'),
  });
  const window = getMonthlyQuotationReportDataWindow(filters);
  assert.equal(window.previousDateFrom, '2026-05-31');
  assert.equal(window.previousDateTo, '2026-07-01');
  assert.equal(window.trendDateFrom, '2026-02-01');

  const result = buildMonthlyQuotationReport({
    records,
    filters,
    businessUnit: {
      id: INTERNATIONAL_BUSINESS_UNIT_ID,
      displayName: 'Yurt Dışı',
      currencyCode: 'USD',
    },
    businessUnits: [
      {
        id: INTERNATIONAL_BUSINESS_UNIT_ID,
        displayName: 'Yurt Dışı',
        currencyCode: 'USD',
      },
    ],
    generatedAt: '2026-07-25T12:00:00.000Z',
    lastSyncAt: '2026-07-25T11:00:00.000Z',
  });

  assert.equal(result.metrics.quotationCount, 4);
  assert.equal(result.metrics.realizedCount, 1);
  assert.equal(result.metrics.openCount, 1);
  assert.equal(result.metrics.expiredCount, 1);
  assert.equal(result.metrics.cancelledCount, 1);
  assert.equal(result.metrics.notRealizedCount, 2);
  assert.equal(result.metrics.quotedCustomerCount, 3);
  assert.equal(result.metrics.conversionRate, 0.25);
  assert.equal(result.previousMetrics.quotationCount, 1);
  assert.equal(result.previousMetrics.realizedCount, 1);
  assert.equal(result.changes.quotationCount.absolute, 3);
  assert.equal(result.openWithoutValidityCount, 1);
  assert.equal(result.salespeople[0]?.displayName, 'Ayşe Satış');
  assert.equal(result.salespeople.find(({ salespersonId }) => salespersonId === null)?.metrics.openCount, 1);
  assert.equal(result.customers[0]?.displayName, 'Alpha Sağlık');
  assert.equal(result.details.length, 4);
  assert.equal(result.trend.at(-1)?.month, '2026-07');
  assert.equal(result.trend.at(-1)?.quotationCount, 4);
});

test('applies not-realized status and salesperson filters to the full report', () => {
  const filters = normalizeMonthlyQuotationReportFilters({
    request: {
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
      salespersonId: 10,
      status: 'not_realized',
      view: 'salesperson',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: new Date('2026-07-25T12:00:00.000Z'),
  });
  const result = buildMonthlyQuotationReport({
    records,
    filters,
    businessUnit: {
      id: INTERNATIONAL_BUSINESS_UNIT_ID,
      displayName: 'Yurt Dışı',
      currencyCode: 'USD',
    },
    businessUnits: [
      {
        id: INTERNATIONAL_BUSINESS_UNIT_ID,
        displayName: 'Yurt Dışı',
        currencyCode: 'USD',
      },
    ],
    generatedAt: '2026-07-25T12:00:00.000Z',
    lastSyncAt: null,
  });

  assert.equal(result.metrics.quotationCount, 1);
  assert.equal(result.metrics.expiredCount, 1);
  assert.equal(result.details[0]?.id, 3);
  assert.equal(result.filters.view, 'salesperson');
});
