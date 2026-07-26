import assert from 'node:assert/strict';
import test from 'node:test';

import ExcelJS from 'exceljs';

import {
  INTERNATIONAL_BUSINESS_UNIT_ID,
  normalizeQuotationConversionFilters,
} from '@ertip/reporting';

import { getDemoQuotationConversionReport } from './quotation-conversion-demo.ts';
import {
  buildQuotationConversionXlsx,
  createQuotationConversionExportFilename,
} from './quotation-conversion-report-export.ts';

const generatedAt = new Date('2026-07-26T12:00:00.000Z');

function createReport() {
  const filters = normalizeQuotationConversionFilters({
    request: {
      businessUnitId: INTERNATIONAL_BUSINESS_UNIT_ID,
      dateFrom: '2026-07-01',
      dateTo: '2026-08-01',
    },
    allowedBusinessUnitIds: [INTERNATIONAL_BUSINESS_UNIT_ID],
    now: generatedAt,
  });
  return getDemoQuotationConversionReport(filters, generatedAt);
}

test('creates complete conversion XLSX with cohort, lag and anomaly details', async () => {
  const report = createReport();
  const buffer = await buildQuotationConversionXlsx(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  assert.ok(buffer.byteLength > 1_000);
  assert.deepEqual(
    workbook.worksheets.map(({ name }) => name),
    ['Özet', 'Gecikme Dağılımı', 'Aylık Eğilim', 'Personel', 'Müşteri', 'Teklif Detayı'],
  );
  assert.equal(workbook.getWorksheet('Gecikme Dağılımı')?.rowCount, report.lagDistribution.length + 1);
  assert.equal(workbook.getWorksheet('Personel')?.rowCount, report.salespeople.length + 1);
  assert.equal(workbook.getWorksheet('Müşteri')?.rowCount, report.customers.length + 1);
  assert.equal(workbook.getWorksheet('Teklif Detayı')?.rowCount, report.detailTotalCount + 1);
  assert.match(
    createQuotationConversionExportFilename(report),
    /teklif-siparis-donusumu_2026-07-01_2026-08-01\.xlsx$/u,
  );
});
