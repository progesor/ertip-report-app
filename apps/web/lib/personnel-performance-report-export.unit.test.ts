import assert from 'node:assert/strict';
import test from 'node:test';

import ExcelJS from 'exceljs';

import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizePersonnelPerformanceFilters,
} from '@ertip/reporting';

import { getDemoPersonnelPerformanceReport } from './demo-report.ts';
import {
  buildPersonnelPerformanceXlsx,
  createPersonnelPerformanceExportFilename,
} from './personnel-performance-report-export.ts';

const generatedAt = new Date('2026-07-26T12:00:00.000Z');

function createReport() {
  const filters = normalizePersonnelPerformanceFilters({
    request: {
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      salespersonId: 10,
      dateFrom: '2026-02-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: generatedAt,
  });
  return getDemoPersonnelPerformanceReport(filters, generatedAt, 10_000);
}

test('creates complete personnel performance XLSX with separate currency analysis', async () => {
  const report = createReport();
  const buffer = await buildPersonnelPerformanceXlsx(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  assert.ok(buffer.byteLength > 1_000);
  assert.deepEqual(
    workbook.worksheets.map(({ name }) => name),
    ['Özet', 'Tutar Analizi', 'Ekip Karşılaştırması', 'Müşteri Yoğunluğu', 'Aylık Eğilim', 'Teklif Detayı'],
  );
  assert.equal(workbook.getWorksheet('Özet')?.getCell('B7').value, report.salesperson.id);
  assert.equal(
    workbook.getWorksheet('Tutar Analizi')?.rowCount,
    report.currencies.length + 1,
  );
  assert.equal(
    workbook.getWorksheet('Teklif Detayı')?.rowCount,
    report.detailTotalCount + 1,
  );
  assert.match(
    createPersonnelPerformanceExportFilename(report),
    /ecem-aygul_personel-performansi/u,
  );
});
