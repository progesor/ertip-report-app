import ExcelJS from 'exceljs';

import type {
  CurrencyAmountMetrics,
  PersonnelPerformanceReportResult,
} from '@ertip/reporting';

const trDateTime = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const statusLabels: Readonly<Record<string, string>> = {
  all: 'Tüm durumlar',
  realized: 'Gerçekleşti',
  open: 'Açık',
  not_realized: 'Gerçekleşmedi',
  expired: 'Süresi doldu',
  cancelled: 'İptal',
  unknown: 'Bilinmiyor',
};

function formatDateTime(value: string | null): string {
  return value ? trDateTime.format(new Date(value)) : '—';
}

function sanitizeFilename(value: string): string {
  return value
    .replaceAll('Ç', 'C')
    .replaceAll('ç', 'c')
    .replaceAll('Ğ', 'G')
    .replaceAll('ğ', 'g')
    .replaceAll('İ', 'I')
    .replaceAll('ı', 'i')
    .replaceAll('Ö', 'O')
    .replaceAll('ö', 'o')
    .replaceAll('Ş', 'S')
    .replaceAll('ş', 's')
    .replaceAll('Ü', 'U')
    .replaceAll('ü', 'u')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase();
}

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

function amountsAsText(
  amounts: readonly CurrencyAmountMetrics[],
  field: 'quotationAmount' | 'realizedAmount',
): string {
  return amounts.map((row) => `${row.currencyCode} ${row[field]}`).join(' | ');
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  report: PersonnelPerformanceReportResult,
): void {
  const sheet = workbook.addWorksheet('Özet');
  sheet.columns = [
    { header: 'Alan', key: 'field', width: 40 },
    { header: 'Değer', key: 'value', width: 60 },
  ];
  styleHeader(sheet.getRow(1));
  const customer =
    report.filters.customerId === null
      ? 'Tüm müşteriler'
      : report.options.customers.find(({ id }) => id === report.filters.customerId)?.displayName ??
        `Odoo müşteri #${report.filters.customerId}`;
  const rows: readonly [string, string | number][] = [
    ['Rapor', report.definition.name],
    ['Rapor sürümü', report.definition.version],
    ['Metrik sürümü', report.definition.metricVersion],
    ['İş birimi', report.businessUnit.displayName],
    ['Personel', report.salesperson.displayName],
    ['Odoo kullanıcı ID', report.salesperson.id],
    ['Dönem başlangıcı', report.filters.dateFrom],
    ['Dönem bitişi (hariç)', report.filters.dateTo],
    ['Önceki dönem başlangıcı', report.previousPeriod.dateFrom],
    ['Önceki dönem bitişi (hariç)', report.previousPeriod.dateTo],
    ['Müşteri filtresi', customer],
    ['Durum filtresi', statusLabels[report.filters.status] ?? report.filters.status],
    ['Oluşturulma', formatDateTime(report.generatedAt)],
    ['Son senkronizasyon', formatDateTime(report.lastSyncAt)],
    ['Teklif sayısı', report.metrics.quotationCount],
    ['Gerçekleşen satış sayısı', report.metrics.realizedCount],
    ['Açık teklif sayısı', report.metrics.openCount],
    ['Gerçekleşmeyen teklif sayısı', report.metrics.notRealizedCount],
    ['Müşteri sayısı', report.metrics.quotedCustomerCount],
    ['Adet dönüşüm oranı', report.metrics.conversionRate ?? 0],
    ['Ekipte aktif personel', report.teamComparison.activeMemberCount],
    ['Teklif sırası', report.teamComparison.quotationRank],
    ['Gerçekleşen satış sırası', report.teamComparison.realizedRank],
    ['Dönüşüm sırası', report.teamComparison.conversionRank],
    ['İlk müşteri payı', report.concentration.topCustomerShare],
    ['İlk üç müşteri payı', report.concentration.topThreeCustomerShare],
  ];
  for (const [field, value] of rows) sheet.addRow({ field, value });
  sheet.getColumn('field').font = { bold: true };
  sheet.getCell('B20').numFmt = '0.0%';
  sheet.getCell('B25').numFmt = '0.0%';
  sheet.getCell('B26').numFmt = '0.0%';
  finishSheet(sheet);
}

function addAmountSheet(
  workbook: ExcelJS.Workbook,
  report: PersonnelPerformanceReportResult,
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
    { header: 'Açık teklif tutarı', key: 'open', width: 22 },
    { header: 'Gerçekleşmeyen tutar', key: 'notRealized', width: 24 },
    { header: 'Ekip medyanı teklif', key: 'medianQuotation', width: 24 },
    { header: 'Ekip medyanı satış', key: 'medianRealized', width: 24 },
    { header: 'Tutar dönüşümü', key: 'conversion', width: 18 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.currencies) {
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
      medianQuotation: Number(row.teamMedian.quotationAmount),
      medianRealized: Number(row.teamMedian.realizedAmount),
      conversion: row.current.amountConversionRate,
    });
  }
  for (const key of [
    'quotation',
    'previousQuotation',
    'quotationChange',
    'realized',
    'previousRealized',
    'realizedChange',
    'open',
    'notRealized',
    'medianQuotation',
    'medianRealized',
  ]) {
    sheet.getColumn(key).numFmt = '#,##0.00';
  }
  sheet.getColumn('quotationPercent').numFmt = '0.0%';
  sheet.getColumn('realizedPercent').numFmt = '0.0%';
  sheet.getColumn('conversion').numFmt = '0.0%';
  finishSheet(sheet);
}

function addTeamSheet(
  workbook: ExcelJS.Workbook,
  report: PersonnelPerformanceReportResult,
): void {
  const sheet = workbook.addWorksheet('Ekip Karşılaştırması');
  sheet.columns = [
    { header: 'Personel', key: 'name', width: 32 },
    { header: 'Odoo kullanıcı ID', key: 'id', width: 18 },
    { header: 'Seçili', key: 'selected', width: 12 },
    { header: 'Teklif', key: 'quotation', width: 12 },
    { header: 'Gerçekleşen', key: 'realized', width: 15 },
    { header: 'Açık', key: 'open', width: 12 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 18 },
    { header: 'Müşteri', key: 'customers', width: 12 },
    { header: 'Dönüşüm', key: 'conversion', width: 14 },
    { header: 'Teklif tutarları', key: 'quotationAmounts', width: 42 },
    { header: 'Satış tutarları', key: 'realizedAmounts', width: 42 },
    { header: 'Son teklif', key: 'last', width: 20 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.teamMembers) {
    sheet.addRow({
      name: row.displayName,
      id: row.salespersonId,
      selected: row.selected ? 'Evet' : 'Hayır',
      quotation: row.metrics.quotationCount,
      realized: row.metrics.realizedCount,
      open: row.metrics.openCount,
      notRealized: row.metrics.notRealizedCount,
      customers: row.customerCount,
      conversion: row.metrics.conversionRate,
      quotationAmounts: amountsAsText(row.amounts, 'quotationAmount'),
      realizedAmounts: amountsAsText(row.amounts, 'realizedAmount'),
      last: row.lastQuotationDate ? new Date(row.lastQuotationDate) : null,
    });
  }
  sheet.getColumn('conversion').numFmt = '0.0%';
  sheet.getColumn('last').numFmt = 'dd.mm.yyyy hh:mm';
  finishSheet(sheet);
}

function addCustomerSheet(
  workbook: ExcelJS.Workbook,
  report: PersonnelPerformanceReportResult,
): void {
  const sheet = workbook.addWorksheet('Müşteri Yoğunluğu');
  sheet.columns = [
    { header: 'Müşteri', key: 'name', width: 42 },
    { header: 'Odoo müşteri ID', key: 'id', width: 18 },
    { header: 'Teklif', key: 'quotation', width: 12 },
    { header: 'Gerçekleşen', key: 'realized', width: 15 },
    { header: 'Açık', key: 'open', width: 12 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 18 },
    { header: 'Dönüşüm', key: 'conversion', width: 14 },
    { header: 'Teklif payı', key: 'share', width: 14 },
    { header: 'Teklif tutarları', key: 'quotationAmounts', width: 42 },
    { header: 'Satış tutarları', key: 'realizedAmounts', width: 42 },
    { header: 'Son teklif', key: 'last', width: 20 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.customers) {
    sheet.addRow({
      name: row.displayName,
      id: row.customerId,
      quotation: row.metrics.quotationCount,
      realized: row.metrics.realizedCount,
      open: row.metrics.openCount,
      notRealized: row.metrics.notRealizedCount,
      conversion: row.metrics.conversionRate,
      share: row.quotationShare,
      quotationAmounts: amountsAsText(row.amounts, 'quotationAmount'),
      realizedAmounts: amountsAsText(row.amounts, 'realizedAmount'),
      last: new Date(row.lastQuotationDate),
    });
  }
  sheet.getColumn('conversion').numFmt = '0.0%';
  sheet.getColumn('share').numFmt = '0.0%';
  sheet.getColumn('last').numFmt = 'dd.mm.yyyy hh:mm';
  finishSheet(sheet);
}

function addTrendSheet(
  workbook: ExcelJS.Workbook,
  report: PersonnelPerformanceReportResult,
): void {
  const sheet = workbook.addWorksheet('Aylık Eğilim');
  sheet.columns = [
    { header: 'Ay', key: 'month', width: 14 },
    { header: 'Teklif', key: 'quotation', width: 12 },
    { header: 'Gerçekleşen', key: 'realized', width: 15 },
    { header: 'Açık', key: 'open', width: 12 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 18 },
    { header: 'Müşteri', key: 'customers', width: 12 },
    { header: 'Dönüşüm', key: 'conversion', width: 14 },
    { header: 'Teklif tutarları', key: 'quotationAmounts', width: 42 },
    { header: 'Satış tutarları', key: 'realizedAmounts', width: 42 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.trend) {
    sheet.addRow({
      month: row.month,
      quotation: row.metrics.quotationCount,
      realized: row.metrics.realizedCount,
      open: row.metrics.openCount,
      notRealized: row.metrics.notRealizedCount,
      customers: row.metrics.quotedCustomerCount,
      conversion: row.metrics.conversionRate,
      quotationAmounts: amountsAsText(row.amounts, 'quotationAmount'),
      realizedAmounts: amountsAsText(row.amounts, 'realizedAmount'),
    });
  }
  sheet.getColumn('conversion').numFmt = '0.0%';
  finishSheet(sheet);
}

function addDetailSheet(
  workbook: ExcelJS.Workbook,
  report: PersonnelPerformanceReportResult,
): void {
  const sheet = workbook.addWorksheet('Teklif Detayı');
  sheet.columns = [
    { header: 'Odoo ID', key: 'id', width: 12 },
    { header: 'Oluşturma', key: 'created', width: 20 },
    { header: 'Müşteri', key: 'customer', width: 42 },
    { header: 'Odoo müşteri ID', key: 'customerId', width: 18 },
    { header: 'Durum', key: 'status', width: 20 },
    { header: 'Kaynak durum', key: 'sourceState', width: 17 },
    { header: 'Geçerlilik', key: 'validityDate', width: 16 },
    { header: 'Tutar', key: 'amount', width: 18 },
    { header: 'Para birimi', key: 'currency', width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.details) {
    sheet.addRow({
      id: row.id,
      created: new Date(row.createDate),
      customer: row.customerName,
      customerId: row.customerId,
      status: statusLabels[row.normalizedStatus] ?? row.normalizedStatus,
      sourceState: row.sourceState,
      validityDate: row.validityDate ? new Date(`${row.validityDate}T00:00:00.000Z`) : null,
      amount: Number(row.amountTotal),
      currency: row.currencyCode,
    });
  }
  sheet.getColumn('created').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn('validityDate').numFmt = 'dd.mm.yyyy';
  sheet.getColumn('amount').numFmt = '#,##0.00';
  finishSheet(sheet);
}

export function createPersonnelPerformanceExportFilename(
  report: PersonnelPerformanceReportResult,
): string {
  return `${sanitizeFilename(report.businessUnit.displayName)}_${sanitizeFilename(report.salesperson.displayName)}_personel-performansi_${report.filters.dateFrom}_${report.filters.dateTo}.xlsx`;
}

export async function buildPersonnelPerformanceXlsx(
  report: PersonnelPerformanceReportResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ertip Report App';
  workbook.company = 'Er Tıbbi Ürünler';
  workbook.created = new Date(report.generatedAt);
  workbook.modified = new Date(report.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  addSummarySheet(workbook, report);
  addAmountSheet(workbook, report);
  addTeamSheet(workbook, report);
  addCustomerSheet(workbook, report);
  addTrendSheet(workbook, report);
  addDetailSheet(workbook, report);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
