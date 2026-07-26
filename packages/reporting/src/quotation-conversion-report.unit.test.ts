import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildQuotationConversionReport,
  calculateQuotationConversionMetrics,
  normalizeQuotationConversionFilters,
  type QuotationConversionSourceRecord,
} from './quotation-conversion-report.ts';

const businessUnit = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Yurt Dışı',
  currencyCode: 'USD',
} as const;
const generatedAt = new Date('2026-07-26T12:00:00.000Z');

function record(input: {
  readonly id: number;
  readonly state: string;
  readonly createDate: string;
  readonly dateOrder?: string;
  readonly salespersonId?: number;
  readonly salespersonName?: string;
  readonly customerId?: number;
  readonly customerName?: string;
}): QuotationConversionSourceRecord {
  return {
    id: input.id,
    state: input.state,
    createDate: `${input.createDate}T08:00:00.000Z`,
    dateOrder: `${input.dateOrder ?? input.createDate}T10:00:00.000Z`,
    validityDate: null,
    salespersonId: input.salespersonId ?? 10,
    salespersonName: input.salespersonName ?? 'Ecem Aygül',
    customerId: input.customerId ?? 101,
    customerName: input.customerName ?? 'Atlas',
    amountTotal: '1000',
    currencyCode: 'USD',
  };
}

const records: readonly QuotationConversionSourceRecord[] = [
  record({ id: 1, state: 'sale', createDate: '2026-07-03', dateOrder: '2026-07-03' }),
  record({ id: 2, state: 'sale', createDate: '2026-07-05', dateOrder: '2026-07-10' }),
  record({
    id: 3,
    state: 'sale',
    createDate: '2026-07-15',
    dateOrder: '2026-08-24',
    salespersonId: 17,
    salespersonName: 'Mert Demir',
    customerId: 102,
    customerName: 'Northstar',
  }),
  record({
    id: 4,
    state: 'sale',
    createDate: '2026-07-20',
    dateOrder: '2026-07-19',
    salespersonId: 17,
    salespersonName: 'Mert Demir',
    customerId: 103,
    customerName: 'Nova',
  }),
  record({ id: 5, state: 'draft', createDate: '2026-07-22', customerId: 102, customerName: 'Northstar' }),
  record({ id: 6, state: 'cancel', createDate: '2026-07-24', customerId: 103, customerName: 'Nova' }),
  record({ id: 7, state: 'sale', createDate: '2026-06-02', dateOrder: '2026-06-05' }),
  record({ id: 8, state: 'draft', createDate: '2026-06-12' }),
];

function buildReport() {
  const filters = normalizeQuotationConversionFilters({
    request: {
      businessUnitId: businessUnit.id,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [businessUnit.id],
    now: generatedAt,
  });
  return buildQuotationConversionReport({
    records,
    filters,
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [businessUnit.id],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: '2026-07-25T20:04:00.000Z',
  });
}

test('calculates cohort conversion, lag distribution and cross-month timing', () => {
  const report = buildReport();

  assert.equal(report.metrics.quotationCount, 6);
  assert.equal(report.metrics.convertedCount, 4);
  assert.equal(report.metrics.notConvertedCount, 2);
  assert.equal(report.metrics.conversionRate, 4 / 6);
  assert.equal(report.metrics.validLagConvertedCount, 3);
  assert.equal(report.metrics.sameMonthConvertedCount, 2);
  assert.equal(report.metrics.crossMonthConvertedCount, 1);
  assert.equal(report.metrics.anomalyCount, 1);
  assert.equal(report.metrics.averageLagDays, 15);
  assert.equal(report.metrics.medianLagDays, 5);
  assert.equal(report.metrics.p90LagDays, 40);
  assert.equal(report.previousMetrics.quotationCount, 2);
  assert.equal(report.previousMetrics.convertedCount, 1);
  assert.equal(report.lagDistribution.find(({ code }) => code === 'same_day')?.count, 1);
  assert.equal(report.lagDistribution.find(({ code }) => code === '1_7')?.count, 1);
  assert.equal(report.lagDistribution.find(({ code }) => code === '31_60')?.count, 1);
  assert.equal(report.lagDistribution.find(({ code }) => code === 'anomaly')?.count, 1);
});

test('keeps source anomalies explicit and out of valid lag statistics', () => {
  const report = buildReport();
  assert.equal(report.anomalies.totalCount, 1);
  assert.equal(report.anomalies.confirmationBeforeQuotationCount, 1);
  const anomaly = report.details.find(({ id }) => id === 4);
  assert.equal(anomaly?.lagDays, -1);
  assert.equal(anomaly?.dateRelation, 'anomaly');
  assert.equal(anomaly?.lagBucket, 'anomaly');
  assert.equal(anomaly?.anomalyCode, 'confirmation_before_quotation');
});

test('builds salesperson and customer conversion breakdowns', () => {
  const report = buildReport();
  const ecem = report.salespeople.find(({ id }) => id === 10);
  const mert = report.salespeople.find(({ id }) => id === 17);
  assert.equal(ecem?.metrics.quotationCount, 4);
  assert.equal(ecem?.metrics.convertedCount, 2);
  assert.equal(mert?.metrics.quotationCount, 2);
  assert.equal(mert?.metrics.convertedCount, 2);
  assert.equal(report.customers.find(({ id }) => id === 102)?.metrics.quotationCount, 2);
  assert.equal(report.scope.serverEnforced, true);
});

test('applies optional dimensions and rejects unauthorized scope', () => {
  const filters = normalizeQuotationConversionFilters({
    request: {
      businessUnitId: businessUnit.id,
      salespersonId: 17,
      customerId: 102,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [businessUnit.id],
    now: generatedAt,
  });
  const report = buildQuotationConversionReport({
    records,
    filters,
    businessUnit,
    businessUnits: [businessUnit],
    allowedBusinessUnitIds: [businessUnit.id],
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: null,
  });
  assert.equal(report.metrics.quotationCount, 1);
  assert.equal(report.metrics.convertedCount, 1);

  assert.throws(
    () =>
      normalizeQuotationConversionFilters({
        request: { businessUnitId: businessUnit.id },
        allowedBusinessUnitIds: ['22222222-2222-4222-8222-222222222222'],
        now: generatedAt,
      }),
    /REPORT_SCOPE_DENIED/u,
  );
});

test('exposes the metric calculator for deterministic reconciliation', () => {
  const july = records.filter(({ createDate }) => createDate.startsWith('2026-07'));
  assert.deepEqual(calculateQuotationConversionMetrics(july), buildReport().metrics);
});
