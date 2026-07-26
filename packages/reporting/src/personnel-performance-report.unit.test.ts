import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMonthlyQuotationReport } from './monthly-quotation-report.ts';
import {
  buildPersonnelPerformanceReport,
  normalizePersonnelPerformanceFilters,
  type PersonnelPerformanceSourceRecord,
} from './personnel-performance-report.ts';

const businessUnit = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Yurt Dışı',
  currencyCode: 'USD',
} as const;
const generatedAt = new Date('2026-07-26T12:00:00.000Z');
const salespeople = [
  { id: 10, displayName: 'Ecem Aygül' },
  { id: 17, displayName: 'Mert Demir' },
  { id: 18, displayName: 'Selin Kaya' },
] as const;

function record(
  id: number,
  salespersonId: number,
  salespersonName: string,
  customerId: number,
  customerName: string,
  state: string,
  createDate: string,
  amountTotal: string,
  currencyCode: string,
  validityDate: string | null = null,
): PersonnelPerformanceSourceRecord {
  return {
    id,
    salespersonId,
    salespersonName,
    customerId,
    customerName,
    state,
    createDate,
    dateOrder: createDate,
    amountTotal,
    currencyCode,
    validityDate,
  };
}

const records: readonly PersonnelPerformanceSourceRecord[] = [
  record(1, 10, 'Ecem Aygül', 101, 'Atlas', 'sale', '2026-07-03T08:00:00.000Z', '1000', 'USD'),
  record(2, 10, 'Ecem Aygül', 102, 'Northstar', 'draft', '2026-07-08T08:00:00.000Z', '500', 'USD', '2026-08-10'),
  record(3, 10, 'Ecem Aygül', 101, 'Atlas', 'cancel', '2026-07-12T08:00:00.000Z', '300', 'EUR'),
  record(4, 10, 'Ecem Aygül', 103, 'Medline', 'sale', '2026-07-20T08:00:00.000Z', '700', 'EUR'),
  record(5, 10, 'Ecem Aygül', 101, 'Atlas', 'sale', '2026-06-05T08:00:00.000Z', '800', 'USD'),
  record(6, 10, 'Ecem Aygül', 102, 'Northstar', 'draft', '2026-06-10T08:00:00.000Z', '400', 'USD', '2026-08-10'),
  record(7, 17, 'Mert Demir', 101, 'Atlas', 'sale', '2026-07-04T08:00:00.000Z', '600', 'USD'),
  record(8, 17, 'Mert Demir', 104, 'Nova', 'draft', '2026-07-11T08:00:00.000Z', '400', 'USD', '2026-08-10'),
  record(9, 17, 'Mert Demir', 105, 'Orion', 'sale', '2026-07-18T08:00:00.000Z', '200', 'EUR'),
  record(10, 18, 'Selin Kaya', 101, 'Atlas', 'cancel', '2026-07-02T08:00:00.000Z', '100', 'USD'),
  record(11, 18, 'Selin Kaya', 102, 'Northstar', 'draft', '2026-07-13T08:00:00.000Z', '900', 'USD', '2026-08-10'),
  record(12, 18, 'Selin Kaya', 103, 'Medline', 'sale', '2026-07-22T08:00:00.000Z', '1000', 'EUR'),
];

function buildReport() {
  const filters = normalizePersonnelPerformanceFilters({
    request: {
      businessUnitId: businessUnit.id,
      salespersonId: 10,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [businessUnit.id],
    now: generatedAt,
  });
  return buildPersonnelPerformanceReport({
    records,
    filters,
    salesperson: salespeople[0],
    salespeople,
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [businessUnit.id],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-25T20:04:00.000Z',
  });
}

test('builds current, previous, team median and currency amount performance', () => {
  const report = buildReport();

  assert.equal(report.metrics.quotationCount, 4);
  assert.equal(report.metrics.realizedCount, 2);
  assert.equal(report.metrics.openCount, 1);
  assert.equal(report.metrics.notRealizedCount, 1);
  assert.equal(report.metrics.quotedCustomerCount, 3);
  assert.equal(report.metrics.conversionRate, 0.5);
  assert.equal(report.previousMetrics.quotationCount, 2);
  assert.equal(report.previousMetrics.realizedCount, 1);
  assert.equal(report.teamComparison.activeMemberCount, 3);
  assert.equal(report.teamComparison.median.quotationCount, 3);
  assert.equal(report.teamComparison.quotationRank, 1);
  assert.equal(report.concentration.topCustomerShare, 0.5);
  assert.equal(report.concentration.topThreeCustomerShare, 1);

  const usd = report.currencies.find(({ currencyCode }) => currencyCode === 'USD');
  assert.equal(usd?.current.quotationAmount, '1500');
  assert.equal(usd?.current.realizedAmount, '1000');
  assert.equal(usd?.previous.quotationAmount, '1200');
  assert.equal(usd?.teamMedian.realizedAmount, '600');

  const eur = report.currencies.find(({ currencyCode }) => currencyCode === 'EUR');
  assert.equal(eur?.current.quotationAmount, '1000');
  assert.equal(eur?.current.realizedAmount, '700');
  assert.equal(eur?.current.notRealizedAmount, '300');
  assert.equal(eur?.teamMedian.realizedAmount, '700');
  assert.equal(report.details[0]?.id, 4);
});

test('reconciles selected-person counts with the canonical monthly report engine', () => {
  const personnel = buildReport();
  const monthly = buildMonthlyQuotationReport({
    records,
    filters: {
      businessUnitId: businessUnit.id,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
      salespersonId: 10,
      customerId: null,
      status: 'all',
      view: 'salesperson',
    },
    businessUnit,
    businessUnits: [businessUnit],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: null,
  });

  assert.deepEqual(personnel.metrics, monthly.metrics);
  assert.deepEqual(personnel.previousMetrics, monthly.previousMetrics);
});

test('applies customer and status filters while preserving server scope', () => {
  const filters = normalizePersonnelPerformanceFilters({
    request: {
      businessUnitId: businessUnit.id,
      salespersonId: 10,
      customerId: 101,
      status: 'realized',
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [businessUnit.id],
    now: generatedAt,
  });
  const report = buildPersonnelPerformanceReport({
    records,
    filters,
    salesperson: salespeople[0],
    salespeople,
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [businessUnit.id],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: null,
  });

  assert.equal(report.metrics.quotationCount, 1);
  assert.equal(report.metrics.realizedCount, 1);
  assert.equal(report.customers[0]?.customerId, 101);
  assert.equal(report.scope.serverEnforced, true);
});

test('fails closed for unauthorized business units and mismatched salesperson identity', () => {
  assert.throws(
    () =>
      normalizePersonnelPerformanceFilters({
        request: { businessUnitId: businessUnit.id, salespersonId: 10 },
        allowedBusinessUnitIds: ['22222222-2222-4222-8222-222222222222'],
        now: generatedAt,
      }),
    /REPORT_SCOPE_DENIED/u,
  );

  const filters = normalizePersonnelPerformanceFilters({
    request: { businessUnitId: businessUnit.id, salespersonId: 10 },
    allowedBusinessUnitIds: [businessUnit.id],
    now: generatedAt,
  });
  assert.throws(
    () =>
      buildPersonnelPerformanceReport({
        records,
        filters,
        salesperson: salespeople[1],
        salespeople,
        businessUnit,
        businessUnits: [businessUnit],
        allowedBusinessUnitIds: [businessUnit.id],
        generatedAt: generatedAt.toISOString(),
        lastSyncAt: null,
      }),
    /REPORT_SALESPERSON_MISMATCH/u,
  );
});
