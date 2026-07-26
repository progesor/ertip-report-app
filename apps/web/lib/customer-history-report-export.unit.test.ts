import assert from 'node:assert/strict';
import test from 'node:test';

import ExcelJS from 'exceljs';

import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeCustomerQuotationHistoryFilters,
} from '@ertip/reporting';

import { getDemoCustomerQuotationHistoryReport } from './demo-report.ts';
import {
  buildCustomerQuotationHistoryXlsx,
  createCustomerHistoryExportFilename,
} from './customer-history-report-export.ts';

const generatedAt = new Date('2026-07-26T12:00:00.000Z');

function createReport() {
  const filters = normalizeCustomerQuotationHistoryFilters({
    request: {
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      customerId: 101,
      dateFrom: '2026-01-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: generatedAt,
  });
  return getDemoCustomerQuotationHistoryReport(filters, generatedAt, 10_000);
}

test('creates structured customer history XLSX with complete timeline', async () => {
  const report = createReport();
  const buffer = await buildCustomerQuotationHistoryXlsx(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  assert.ok(buffer.byteLength > 1_000);
  assert.deepEqual(
    workbook.worksheets.map(({ name }) => name),
    ['Özet', 'Durum Dağılımı', 'Personel Geçmişi', 'Aylık Frekans', 'Zaman Çizelgesi'],
  );
  assert.equal(workbook.getWorksheet('Özet')?.getCell('B6').value, report.customer.id);
  assert.equal(workbook.getWorksheet('Zaman Çizelgesi')?.rowCount, report.timelineTotalCount + 1);
  assert.match(createCustomerHistoryExportFilename(report), /atlas-hospital-group_teklif-gecmisi/u);
});
