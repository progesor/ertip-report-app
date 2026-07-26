import ExcelJS from 'exceljs';

import type { CustomerQuotationHistoryReportResult } from '@ertip/reporting';

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

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  report: CustomerQuotationHistoryReportResult,
): void {
  const sheet = workbook.addWorksheet('Özet');
  sheet.columns = [
    { header: 'Alan', key: 'field', width: 38 },
    { header: 'Değer', key: 'value', width: 58 },
  ];
  styleHeader(sheet.getRow(1));
  const salesperson =
    report.filters.salespersonId === null
      ? 'Tüm personel'
      : report.options.salespeople.find(({ id }) => id === report.filters.salespersonId)
          ?.displayName ?? `Odoo #${report.filters.salespersonId}`;
  const rows: readonly [string, string | number][] = [
    ['Rapor', report.definition.name],
    ['Rapor sürümü', report.definition.version],
    ['Metrik sürümü', report.definition.metricVersion],
    ['İş birimi', report.businessUnit.displayName],
    ['Müşteri', report.customer.displayName],
    ['Odoo müşteri ID', report.customer.id],
    ['Dönem başlangıcı', report.filters.dateFrom],
    ['Dönem bitişi (hariç)', report.filters.dateTo],
    ['Personel filtresi', salesperson],
    ['Durum filtresi', statusLabels[report.filters.status] ?? report.filters.status],
    ['Oluşturulma', formatDateTime(report.generatedAt)],
    ['Son senkronizasyon', formatDateTime(report.lastSyncAt)],
    ['Dönem teklif sayısı', report.metrics.quotationCount],
    ['Gerçekleşen', report.metrics.realizedCount],
    ['Açık', report.metrics.openCount],
    ['Gerçekleşmeyen', report.metrics.notRealizedCount],
    ['Dönüşüm oranı', report.metrics.conversionRate ?? 0],
    ['Tüm zamanlar teklif sayısı', report.allTime.quotationCount],
    ['İlk teklif', formatDateTime(report.allTime.firstQuotationDate)],
    ['Son teklif', formatDateTime(report.allTime.lastQuotationDate)],
    ['Tekrar teklif sayısı', report.repeat.repeatQuotationCount],
    ['Aktif ay sayısı', report.repeat.activeMonthCount],
    ['Ortalama tekrar aralığı (gün)', report.repeat.averageDaysBetweenQuotations ?? 0],
    ['Medyan tekrar aralığı (gün)', report.repeat.medianDaysBetweenQuotations ?? 0],
  ];

  for (const [field, value] of rows) {
    sheet.addRow({ field, value });
  }
  sheet.getColumn('field').font = { bold: true };
  finishSheet(sheet);
}

function addStatusSheet(
  workbook: ExcelJS.Workbook,
  report: CustomerQuotationHistoryReportResult,
): void {
  const sheet = workbook.addWorksheet('Durum Dağılımı');
  sheet.columns = [
    { header: 'Durum', key: 'status', width: 24 },
    { header: 'Teklif', key: 'count', width: 14 },
    { header: 'Pay', key: 'share', width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.statusDistribution) {
    sheet.addRow({ status: row.label, count: row.count, share: row.share });
  }
  sheet.getColumn('share').numFmt = '0.0%';
  finishSheet(sheet);
}

function addSalespeopleSheet(
  workbook: ExcelJS.Workbook,
  report: CustomerQuotationHistoryReportResult,
): void {
  const sheet = workbook.addWorksheet('Personel Geçmişi');
  sheet.columns = [
    { header: 'Personel', key: 'name', width: 32 },
    { header: 'Odoo kullanıcı ID', key: 'id', width: 18 },
    { header: 'Teklif', key: 'quotation', width: 12 },
    { header: 'Gerçekleşen', key: 'realized', width: 15 },
    { header: 'Açık', key: 'open', width: 12 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 18 },
    { header: 'Dönüşüm', key: 'conversion', width: 14 },
    { header: 'İlk teklif', key: 'first', width: 20 },
    { header: 'Son teklif', key: 'last', width: 20 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.salespersonHistory) {
    sheet.addRow({
      name: row.displayName,
      id: row.salespersonId ?? 'Atanmamış',
      quotation: row.metrics.quotationCount,
      realized: row.metrics.realizedCount,
      open: row.metrics.openCount,
      notRealized: row.metrics.notRealizedCount,
      conversion: row.metrics.conversionRate ?? 0,
      first: new Date(row.firstQuotationDate),
      last: new Date(row.lastQuotationDate),
    });
  }
  sheet.getColumn('conversion').numFmt = '0.0%';
  sheet.getColumn('first').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn('last').numFmt = 'dd.mm.yyyy hh:mm';
  finishSheet(sheet);
}

function addFrequencySheet(
  workbook: ExcelJS.Workbook,
  report: CustomerQuotationHistoryReportResult,
): void {
  const sheet = workbook.addWorksheet('Aylık Frekans');
  sheet.columns = [
    { header: 'Ay', key: 'month', width: 14 },
    { header: 'Teklif', key: 'quotation', width: 12 },
    { header: 'Gerçekleşen', key: 'realized', width: 15 },
    { header: 'Açık', key: 'open', width: 12 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 18 },
    { header: 'Dönüşüm', key: 'conversion', width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.monthlyFrequency) {
    sheet.addRow({
      month: row.month,
      quotation: row.metrics.quotationCount,
      realized: row.metrics.realizedCount,
      open: row.metrics.openCount,
      notRealized: row.metrics.notRealizedCount,
      conversion: row.metrics.conversionRate ?? 0,
    });
  }
  sheet.getColumn('conversion').numFmt = '0.0%';
  finishSheet(sheet);
}

function addTimelineSheet(
  workbook: ExcelJS.Workbook,
  report: CustomerQuotationHistoryReportResult,
): void {
  const sheet = workbook.addWorksheet('Zaman Çizelgesi');
  sheet.columns = [
    { header: 'Sıra', key: 'sequence', width: 10 },
    { header: 'Odoo ID', key: 'id', width: 12 },
    { header: 'Oluşturma', key: 'created', width: 20 },
    { header: 'Önceki teklife gün', key: 'daysSincePrevious', width: 20 },
    { header: 'Personel', key: 'salesperson', width: 30 },
    { header: 'Durum', key: 'status', width: 20 },
    { header: 'Kaynak durum', key: 'sourceState', width: 17 },
    { header: 'Geçerlilik', key: 'validityDate', width: 16 },
    { header: 'Tutar', key: 'amount', width: 18 },
    { header: 'Para birimi', key: 'currency', width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of [...report.timeline].reverse()) {
    sheet.addRow({
      sequence: row.sequenceNumber,
      id: row.id,
      created: new Date(row.createDate),
      daysSincePrevious: row.daysSincePreviousQuotation,
      salesperson: row.salespersonName,
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

export function createCustomerHistoryExportFilename(
  report: CustomerQuotationHistoryReportResult,
): string {
  return `${sanitizeFilename(report.businessUnit.displayName)}_${sanitizeFilename(report.customer.displayName)}_teklif-gecmisi_${report.filters.dateFrom}_${report.filters.dateTo}.xlsx`;
}

export async function buildCustomerQuotationHistoryXlsx(
  report: CustomerQuotationHistoryReportResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ertip Report App';
  workbook.company = 'Er Tıbbi Ürünler';
  workbook.created = new Date(report.generatedAt);
  workbook.modified = new Date(report.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  addSummarySheet(workbook, report);
  addStatusSheet(workbook, report);
  addSalespeopleSheet(workbook, report);
  addFrequencySheet(workbook, report);
  addTimelineSheet(workbook, report);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
