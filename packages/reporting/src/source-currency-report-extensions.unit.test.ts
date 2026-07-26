import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCustomerQuotationHistoryReport } from './customer-quotation-history-report.ts';
import { buildMonthlyQuotationReport } from './monthly-quotation-report.ts';
import { buildOpenAgingQuotationReport } from './open-aging-quotation-report.ts';
import {
  extendCustomerQuotationHistoryReportWithSourceCurrencyAmounts,
  extendMonthlyQuotationReportWithSourceCurrencyAmounts,
  extendOpenAgingQuotationReportWithSourceCurrencyAmounts,
} from './source-currency-report-extensions.ts';

const businessUnit = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Yurt Dışı',
  currencyCode: 'USD',
} as const;
const generatedAt = '2026-07-26T12:00:00.000Z';

const records = [
  {
    id: 1,
    state: 'sale',
    validityDate: null,
    createDate: '2026-07-03T08:00:00.000Z',
    dateOrder: '2026-07-05T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 101,
    customerName: 'Atlas',
    amountTotal: '1000',
    currencyCode: 'USD',
  },
  {
    id: 2,
    state: 'draft',
    validityDate: '2026-08-10',
    createDate: '2026-07-08T08:00:00.000Z',
    dateOrder: '2026-07-08T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 101,
    customerName: 'Atlas',
    amountTotal: '500',
    currencyCode: 'USD',
  },
  {
    id: 3,
    state: 'cancel',
    validityDate: null,
    createDate: '2026-07-12T08:00:00.000Z',
    dateOrder: '2026-07-12T08:00:00.000Z',
    salespersonId: 17,
    salespersonName: 'Mert Demir',
    customerId: 101,
    customerName: 'Atlas',
    amountTotal: '300',
    currencyCode: 'EUR',
  },
  {
    id: 4,
    state: 'draft',
    validityDate: '2026-07-01',
    createDate: '2026-06-20T08:00:00.000Z',
    dateOrder: '2026-06-20T08:00:00.000Z',
    salespersonId: 17,
    salespersonName: 'Mert Demir',
    customerId: 102,
    customerName: 'Northstar',
    amountTotal: '400',
    currencyCode: 'EUR',
  },
  {
    id: 5,
    state: 'sale',
    validityDate: null,
    createDate: '2026-06-05T08:00:00.000Z',
    dateOrder: '2026-06-07T08:00:00.000Z',
    salespersonId: 10,
    salespersonName: 'Ecem Aygül',
    customerId: 101,
    customerName: 'Atlas',
    amountTotal: '800',
    currencyCode: 'USD',
  },
] as const;

test('extends monthly report without changing accepted count metrics', () => {
  const base = buildMonthlyQuotationReport({
    records,
    filters: {
      businessUnitId: businessUnit.id,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
      salespersonId: null,
      customerId: null,
      status: 'all',
      view: 'general',
    },
    businessUnit,
    businessUnits: [businessUnit],
    generatedAt,
    lastSyncAt: null,
  });
  const report = extendMonthlyQuotationReportWithSourceCurrencyAmounts({ report: base, records });

  assert.deepEqual(report.metrics, base.metrics);
  assert.deepEqual(report.previousMetrics, base.previousMetrics);
  const usd = report.amounts.find(({ currencyCode }) => currencyCode === 'USD');
  assert.equal(usd?.current.quotationAmount, '1500');
  assert.equal(usd?.current.realizedAmount, '1000');
  assert.equal(usd?.previous.quotationAmount, '800');
  const eur = report.amounts.find(({ currencyCode }) => currencyCode === 'EUR');
  assert.equal(eur?.current.notRealizedAmount, '300');
  assert.equal('mixedCurrencyTotal' in report, false);
  assert.equal(report.salespeople.find(({ salespersonId }) => salespersonId === 10)?.amounts.length, 1);
});

test('extends customer history with separated monetary history', () => {
  const base = buildCustomerQuotationHistoryReport({
    records,
    filters: {
      businessUnitId: businessUnit.id,
      customerId: 101,
      dateFrom: '2026-06-01',
      dateTo: '2026-08-01',
      salespersonId: null,
      status: 'all',
    },
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [businessUnit.id],
    generatedAt,
    lastSyncAt: null,
  });
  const report = extendCustomerQuotationHistoryReportWithSourceCurrencyAmounts({ report: base, records });

  assert.deepEqual(report.metrics, base.metrics);
  assert.equal(report.amounts.find(({ currencyCode }) => currencyCode === 'USD')?.quotationAmount, '2300');
  assert.equal(report.amounts.find(({ currencyCode }) => currencyCode === 'EUR')?.cancelledAmount, '300');
  assert.equal(report.currencies.find(({ currencyCode }) => currencyCode === 'EUR')?.metrics.quotationAmount, '300');
  assert.equal(report.monthlyFrequency.find(({ month }) => month === '2026-07')?.amounts.length, 2);
});

test('extends open aging with operational open and overdue amounts', () => {
  const base = buildOpenAgingQuotationReport({
    records,
    filters: {
      businessUnitId: businessUnit.id,
      salespersonId: null,
      customerId: null,
      ageBucket: 'all',
      validityGroup: 'all',
    },
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [businessUnit.id],
    generatedAt,
    lastSyncAt: null,
  });
  const report = extendOpenAgingQuotationReportWithSourceCurrencyAmounts({ report: base, records });

  assert.deepEqual(report.metrics, base.metrics);
  assert.equal(report.amounts.find(({ currencyCode }) => currencyCode === 'USD')?.openAmount, '500');
  assert.equal(report.amounts.find(({ currencyCode }) => currencyCode === 'EUR')?.expiredAmount, '400');
  assert.equal(report.validityDistribution.find(({ code }) => code === 'overdue')?.amounts[0]?.expiredAmount, '400');
  assert.equal('mixedCurrencyTotal' in report, false);
});
