import assert from 'node:assert/strict';
import test from 'node:test';

import ExcelJS from 'exceljs';

import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeMonthlyQuotationReportFilters,
} from '@ertip/reporting';

import { getDemoMonthlyQuotationReport } from './demo-report.ts';
import {
  buildMonthlyQuotationXlsx,
  createMonthlyQuotationExportFilename,
  withCompleteMonthlyQuotationDetails,
} from './report-export.ts';
import { buildMonthlyQuotationPdf } from './report-pdf.ts';

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

function countPdfPages(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/gu) ?? []).length;
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

test('creates distinct team and selected-person PDF documents', async () => {
  const report = createReport();
  const teamPdf = await buildMonthlyQuotationPdf({ report, scope: 'all' });
  const salesperson = report.salespeople[0];
  assert.ok(salesperson);
  const selectedReport = {
    ...report,
    filters: { ...report.filters, salespersonId: salesperson.salespersonId },
    salespeople: [salesperson],
    details: report.details.filter(
      ({ salespersonId }) => salespersonId === salesperson.salespersonId,
    ),
  };
  const personPdf = await buildMonthlyQuotationPdf({
    report: selectedReport,
    scope: 'salesperson',
  });

  assert.equal(teamPdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.equal(personPdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(teamPdf.byteLength > 1_000);
  assert.ok(personPdf.byteLength > 1_000);
  assert.ok(countPdfPages(teamPdf) > countPdfPages(personPdf));
  assert.ok(countPdfPages(personPdf) >= 1);
  assert.equal(
    createMonthlyQuotationExportFilename({ report, extension: 'pdf', scope: 'all' }),
    'yurt-disi_aylik-teklif-performansi_2026-07-01_2026-08-01_tum-personel.pdf',
  );
});
