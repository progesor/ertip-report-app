import assert from 'node:assert/strict';
import test from 'node:test';

import ExcelJS from 'exceljs';

import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeCustomerQuotationHistoryFilters,
  normalizeMonthlyQuotationReportFilters,
  normalizeOpenAgingQuotationReportFilters,
} from '@ertip/reporting';

import {
  getDemoCustomerQuotationHistoryReport,
  getDemoMonthlyQuotationReport,
  getDemoOpenAgingQuotationReport,
} from './demo-report.ts';
import {
  buildCustomerQuotationHistoryXlsxWithAmounts,
  buildMonthlyQuotationXlsxWithAmounts,
  buildOpenAgingQuotationXlsxWithAmounts,
} from './source-currency-report-export.ts';

const generatedAt = new Date('2026-07-26T12:00:00.000Z');

async function sheetNames(buffer: Buffer): Promise<readonly string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  return workbook.worksheets.map(({ name }) => name);
}

test('monthly workbook contains separated amount analysis sheets', async () => {
  const filters = normalizeMonthlyQuotationReportFilters({
    request: {
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: generatedAt,
  });
  const report = getDemoMonthlyQuotationReport(filters, generatedAt);
  const buffer = await buildMonthlyQuotationXlsxWithAmounts(report);
  const names = await sheetNames(buffer);

  assert.ok(names.includes('Tutar Analizi'));
  assert.ok(names.includes('Personel Tutarları'));
  assert.ok(names.includes('Müşteri Tutarları'));
  assert.ok(names.includes('Aylık Tutar Eğilimi'));
});

test('open aging workbook contains operational amount breakdowns', async () => {
  const filters = normalizeOpenAgingQuotationReportFilters({
    request: { businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
  });
  const report = getDemoOpenAgingQuotationReport(filters, generatedAt, 10_000);
  const buffer = await buildOpenAgingQuotationXlsxWithAmounts(report);
  const names = await sheetNames(buffer);

  assert.ok(names.includes('Tutar Analizi'));
  assert.ok(names.includes('Yaş Tutarları'));
  assert.ok(names.includes('Geçerlilik Tutarları'));
});

test('customer workbook contains customer monetary history sheets', async () => {
  const filters = normalizeCustomerQuotationHistoryFilters({
    request: {
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      customerId: 101,
      dateFrom: '2026-02-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: generatedAt,
  });
  const report = getDemoCustomerQuotationHistoryReport(filters, generatedAt, 10_000);
  const buffer = await buildCustomerQuotationHistoryXlsxWithAmounts(report);
  const names = await sheetNames(buffer);

  assert.ok(names.includes('Tutar Analizi'));
  assert.ok(names.includes('Personel Tutarları'));
  assert.ok(names.includes('Aylık Tutar Frekansı'));
});
