import assert from 'node:assert/strict';
import test from 'node:test';

import ExcelJS from 'exceljs';

import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeMonthlyQuotationReportFilters,
} from '@ertip/reporting';

import { getDemoMonthlyQuotationReport } from './demo-report.ts';
import {
  buildMonthlyQuotationPdf,
  buildMonthlyQuotationXlsx,
  createMonthlyQuotationExportFilename,
  withCompleteMonthlyQuotationDetails,
} from './report-export.ts';

function createReport() {
  const generatedAt = new Date('2026-07-25T12:00:00.000Z');
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
  return withCompleteMonthlyQuotationDetails(report, report.details);
}

test('creates a structured XLSX workbook from the canonical report result', async () => {
  const report = createReport();
  const buffer = await buildMonthlyQuotationXlsx(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  assert.ok(buffer.byteLength > 1_000);
  assert.deepEqual(
    workbook.worksheets.map(({ name }) => name),
    ['Özet', 'Personel', 'Müşteriler', 'Teklif Detayı'],
  );
  assert.equal(workbook.getWorksheet('Özet')?.getCell('B2').value, report.definition.name);
  assert.equal(
    workbook.getWorksheet('Teklif Detayı')?.rowCount,
    report.details.length + 1,
  );
});

test('creates a PDF artifact and deterministic safe filename', async () => {
  const report = createReport();
  const buffer = await buildMonthlyQuotationPdf({ report, scope: 'all' });

  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(buffer.byteLength > 1_000);
  assert.equal(
    createMonthlyQuotationExportFilename({ report, extension: 'pdf', scope: 'all' }),
    'yurt-disi_aylik-teklif-performansi_2026-07-01_2026-08-01_tum-personel.pdf',
  );
});
