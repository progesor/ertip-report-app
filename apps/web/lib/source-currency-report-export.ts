import ExcelJS from 'exceljs';

import type {
  CurrencyAmountMetrics,
  CustomerQuotationHistoryReportWithAmounts,
  MonthlyQuotationReportWithAmounts,
  OpenAgingQuotationReportWithAmounts,
  SourceCurrencyPeriodComparison,
} from '@ertip/reporting';

import { buildCustomerQuotationHistoryXlsx } from './customer-history-report-export.ts';
import { buildOpenAgingQuotationXlsx } from './open-aging-report-export.ts';
import { buildMonthlyQuotationXlsx } from './report-export.ts';

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF182638' } };
  row.alignment = { vertical: 'middle' };
  row.height = 24;
}

function finishSheet(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: 'A1',
    to: sheet.getCell(1, Math.max(1, sheet.columnCount)).address,
  };
}

function applyAmountFormats(sheet: ExcelJS.Worksheet): void {
  for (const key of [
    'quotation',
    'previousQuotation',
    'quotationChange',
    'realized',
    'previousRealized',
    'realizedChange',
    'open',
    'notRealized',
    'expired',
    'cancelled',
  ]) {
    const column = sheet.getColumn(key);
    if (column.number <= sheet.columnCount) column.numFmt = '#,##0.00';
  }
  for (const key of ['quotationPercent', 'realizedPercent', 'conversion']) {
    const column = sheet.getColumn(key);
    if (column.number <= sheet.columnCount) column.numFmt = '0.0%';
  }
}

function addComparisonSheet(
  workbook: ExcelJS.Workbook,
  rows: readonly SourceCurrencyPeriodComparison[],
): void {
  const sheet = workbook.addWorksheet('Tutar Analizi');
  sheet.columns = [
    { header: 'Para birimi', key: 'currency', width: 14 },
    { header: 'Teklif tutarı', key: 'quotation', width: 20 },
    { header: 'Önceki teklif', key: 'previousQuotation', width: 20 },
    { header: 'Teklif farkı', key: 'quotationChange', width: 20 },
    { header: 'Teklif değişimi', key: 'quotationPercent', width: 18 },
    { header: 'Gerçekleşen satış', key: 'realized', width: 22 },
    { header: 'Önceki satış', key: 'previousRealized', width: 20 },
    { header: 'Satış farkı', key: 'realizedChange', width: 20 },
    { header: 'Satış değişimi', key: 'realizedPercent', width: 18 },
    { header: 'Açık tutar', key: 'open', width: 20 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 22 },
    { header: 'Tutar dönüşümü', key: 'conversion', width: 18 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow({
      currency: row.currencyCode,
      quotation: Number(row.current.quotationAmount),
      previousQuotation: Number(row.previous.quotationAmount),
      quotationChange: Number(row.changes.quotationAmount.absolute),
      quotationPercent: row.changes.quotationAmount.percent,
      realized: Number(row.current.realizedAmount),
      previousRealized: Number(row.previous.realizedAmount),
      realizedChange: Number(row.changes.realizedAmount.absolute),
      realizedPercent: row.changes.realizedAmount.percent,
      open: Number(row.current.openAmount),
      notRealized: Number(row.current.notRealizedAmount),
      conversion: row.current.amountConversionRate,
    });
  }
  applyAmountFormats(sheet);
  finishSheet(sheet);
}

function addCurrentAmountSheet(
  workbook: ExcelJS.Workbook,
  rows: readonly CurrencyAmountMetrics[],
): void {
  const sheet = workbook.addWorksheet('Tutar Analizi');
  sheet.columns = [
    { header: 'Para birimi', key: 'currency', width: 14 },
    { header: 'Toplam teklif', key: 'quotation', width: 20 },
    { header: 'Gerçekleşen satış', key: 'realized', width: 22 },
    { header: 'Açık tutar', key: 'open', width: 20 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 22 },
    { header: 'Süresi dolmuş', key: 'expired', width: 20 },
    { header: 'İptal', key: 'cancelled', width: 18 },
    { header: 'Tutar dönüşümü', key: 'conversion', width: 18 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow({
      currency: row.currencyCode,
      quotation: Number(row.quotationAmount),
      realized: Number(row.realizedAmount),
      open: Number(row.openAmount),
      notRealized: Number(row.notRealizedAmount),
      expired: Number(row.expiredAmount),
      cancelled: Number(row.cancelledAmount),
      conversion: row.amountConversionRate,
    });
  }
  applyAmountFormats(sheet);
  finishSheet(sheet);
}

interface EntityAmountRow {
  readonly label: string;
  readonly sourceId: string | number;
  readonly amounts: readonly CurrencyAmountMetrics[];
}

function addEntityAmountSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  entityHeader: string,
  rows: readonly EntityAmountRow[],
): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [
    { header: entityHeader, key: 'label', width: 36 },
    { header: 'Kaynak ID', key: 'sourceId', width: 18 },
    { header: 'Para birimi', key: 'currency', width: 14 },
    { header: 'Toplam teklif', key: 'quotation', width: 20 },
    { header: 'Gerçekleşen satış', key: 'realized', width: 22 },
    { header: 'Açık tutar', key: 'open', width: 20 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 22 },
    { header: 'Süresi dolmuş', key: 'expired', width: 20 },
    { header: 'İptal', key: 'cancelled', width: 18 },
    { header: 'Tutar dönüşümü', key: 'conversion', width: 18 },
  ];
  styleHeader(sheet.getRow(1));
  for (const entity of rows) {
    for (const amount of entity.amounts) {
      sheet.addRow({
        label: entity.label,
        sourceId: entity.sourceId,
        currency: amount.currencyCode,
        quotation: Number(amount.quotationAmount),
        realized: Number(amount.realizedAmount),
        open: Number(amount.openAmount),
        notRealized: Number(amount.notRealizedAmount),
        expired: Number(amount.expiredAmount),
        cancelled: Number(amount.cancelledAmount),
        conversion: amount.amountConversionRate,
      });
    }
  }
  applyAmountFormats(sheet);
  finishSheet(sheet);
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  return workbook;
}

export async function buildMonthlyQuotationXlsxWithAmounts(
  report: MonthlyQuotationReportWithAmounts,
): Promise<Buffer> {
  const workbook = await loadWorkbook(await buildMonthlyQuotationXlsx(report));
  addComparisonSheet(workbook, report.amounts);
  addEntityAmountSheet(
    workbook,
    'Personel Tutarları',
    'Personel',
    report.salespeople.map((row) => ({
      label: row.displayName,
      sourceId: row.salespersonId ?? 'Atanmamış',
      amounts: row.amounts,
    })),
  );
  addEntityAmountSheet(
    workbook,
    'Müşteri Tutarları',
    'Müşteri',
    report.customers.map((row) => ({
      label: row.displayName,
      sourceId: row.customerId,
      amounts: row.amounts,
    })),
  );
  addEntityAmountSheet(
    workbook,
    'Aylık Tutar Eğilimi',
    'Ay',
    report.trend.map((row) => ({ label: row.month, sourceId: row.month, amounts: row.amounts })),
  );
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildOpenAgingQuotationXlsxWithAmounts(
  report: OpenAgingQuotationReportWithAmounts,
): Promise<Buffer> {
  const workbook = await loadWorkbook(await buildOpenAgingQuotationXlsx(report));
  addCurrentAmountSheet(workbook, report.amounts);
  addEntityAmountSheet(
    workbook,
    'Personel Tutarları',
    'Personel',
    report.salespeople.map((row) => ({
      label: row.displayName,
      sourceId: row.salespersonId ?? 'Atanmamış',
      amounts: row.amounts,
    })),
  );
  addEntityAmountSheet(
    workbook,
    'Müşteri Tutarları',
    'Müşteri',
    report.customers.map((row) => ({
      label: row.displayName,
      sourceId: row.customerId,
      amounts: row.amounts,
    })),
  );
  addEntityAmountSheet(
    workbook,
    'Yaş Tutarları',
    'Yaş kovası',
    report.ageDistribution.map((row) => ({
      label: row.label,
      sourceId: row.code,
      amounts: row.amounts,
    })),
  );
  addEntityAmountSheet(
    workbook,
    'Geçerlilik Tutarları',
    'Geçerlilik grubu',
    report.validityDistribution.map((row) => ({
      label: row.label,
      sourceId: row.code,
      amounts: row.amounts,
    })),
  );
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildCustomerQuotationHistoryXlsxWithAmounts(
  report: CustomerQuotationHistoryReportWithAmounts,
): Promise<Buffer> {
  const workbook = await loadWorkbook(await buildCustomerQuotationHistoryXlsx(report));
  addCurrentAmountSheet(workbook, report.amounts);
  addEntityAmountSheet(
    workbook,
    'Personel Tutarları',
    'Personel',
    report.salespersonHistory.map((row) => ({
      label: row.displayName,
      sourceId: row.salespersonId ?? 'Atanmamış',
      amounts: row.amounts,
    })),
  );
  addEntityAmountSheet(
    workbook,
    'Aylık Tutar Frekansı',
    'Ay',
    report.monthlyFrequency.map((row) => ({
      label: row.month,
      sourceId: row.month,
      amounts: row.amounts,
    })),
  );
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
