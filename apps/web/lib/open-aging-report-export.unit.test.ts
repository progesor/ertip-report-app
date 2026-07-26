import assert from 'node:assert/strict';
import test from 'node:test';

import ExcelJS from 'exceljs';

import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeOpenAgingQuotationReportFilters,
} from '@ertip/reporting';

import { getDemoOpenAgingQuotationReport } from './demo-report.ts';
import {
  buildOpenAgingQuotationXlsx,
  createOpenAgingExportFilename,
} from './open-aging-report-export.ts';

function createReport() {
  const generatedAt = new Date('2026-07-26T12:00:00.000Z');
  const filters = normalizeOpenAgingQuotationReportFilters({
    request: { businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
  });
  return getDemoOpenAgingQuotationReport(filters, generatedAt, 100_000);
}

test('creates filtered operational XLSX from the open-aging result contract', async () => {
  const report = createReport();
  const buffer = await buildOpenAgingQuotationXlsx(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  assert.ok(buffer.byteLength > 1_000);
  assert.deepEqual(
    workbook.worksheets.map(({ name }) => name),
    ['Özet', 'Yaş Dağılımı', 'Geçerlilik', 'Personel', 'Müşteriler', 'Teklif Takibi'],
  );
  assert.equal(workbook.getWorksheet('Özet')?.getCell('B2').value, report.definition.name);
  assert.equal(workbook.getWorksheet('Teklif Takibi')?.rowCount, report.details.length + 1);
  assert.equal(
    createOpenAgingExportFilename(report),
    'yurt-disi_acik-yaslanan-teklifler_2026-07-26.xlsx',
  );
});
