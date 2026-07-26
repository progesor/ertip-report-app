import ExcelJS from 'exceljs';

import type { OpenAgingQuotationReportResult } from '@ertip/reporting';

const trDateTime = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const ageLabels: Readonly<Record<string, string>> = {
  all: 'Tüm yaşlar',
  '0_7': '0–7 gün',
  '8_14': '8–14 gün',
  '15_30': '15–30 gün',
  '31_60': '31–60 gün',
  '61_90': '61–90 gün',
  '90_plus': '90+ gün',
};

const validityLabels: Readonly<Record<string, string>> = {
  all: 'Tüm geçerlilik grupları',
  valid: 'Geçerli',
  nearing_expiry: 'Süresi yaklaşan',
  overdue: 'Süresi dolmuş',
  missing: 'Geçerlilik tarihi eksik',
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

function addSummarySheet(workbook: ExcelJS.Workbook, report: OpenAgingQuotationReportResult): void {
  const sheet = workbook.addWorksheet('Özet');
  sheet.columns = [
    { header: 'Alan', key: 'field', width: 38 },
    { header: 'Değer', key: 'value', width: 54 },
  ];
  styleHeader(sheet.getRow(1));

  const salesperson = report.filters.salespersonId === null
    ? 'Tüm personel'
    : report.options.salespeople.find(({ id }) => id === report.filters.salespersonId)?.displayName ??
      `Odoo #${report.filters.salespersonId}`;
  const customer = report.filters.customerId === null
    ? 'Tüm müşteriler'
    : report.options.customers.find(({ id }) => id === report.filters.customerId)?.displayName ??
      `Odoo #${report.filters.customerId}`;
  const rows: readonly [string, string | number][] = [
    ['Rapor', report.definition.name],
    ['Rapor sürümü', report.definition.version],
    ['Metrik sürümü', report.definition.metricVersion],
    ['İş birimi', report.businessUnit.displayName],
    ['Referans tarihi', report.asOfDate],
    ['Oluşturulma', formatDateTime(report.generatedAt)],
    ['Son senkronizasyon', formatDateTime(report.lastSyncAt)],
    ['Personel filtresi', salesperson],
    ['Müşteri filtresi', customer],
    ['Yaş filtresi', ageLabels[report.filters.ageBucket] ?? report.filters.ageBucket],
    ['Geçerlilik filtresi', validityLabels[report.filters.validityGroup] ?? report.filters.validityGroup],
    ['Takipteki teklif', report.metrics.trackedCount],
    ['Halen açık', report.metrics.currentlyOpenCount],
    ['Süresi dolmuş', report.metrics.overdueCount],
    ['Süresi yaklaşan', report.metrics.nearingExpiryCount],
    ['Geçerlilik tarihi eksik', report.metrics.missingValidityCount],
    ['Müşteri', report.metrics.customerCount],
    ['Personel kovası', report.metrics.salespersonCount],
    ['En yaşlı teklif (gün)', report.metrics.oldestAgeDays],
    ['Detay kayıt sayısı', report.detailTotalCount],
  ];

  for (const [field, value] of rows) {
    sheet.addRow({ field, value });
  }
  sheet.getColumn('field').font = { bold: true };
  finishSheet(sheet);
}

function addAgeSheet(workbook: ExcelJS.Workbook, report: OpenAgingQuotationReportResult): void {
  const sheet = workbook.addWorksheet('Yaş Dağılımı');
  sheet.columns = [
    { header: 'Yaş kovası', key: 'label', width: 22 },
    { header: 'Toplam', key: 'count', width: 14 },
    { header: 'Halen açık', key: 'open', width: 16 },
    { header: 'Süresi dolmuş', key: 'overdue', width: 18 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.ageDistribution) {
    sheet.addRow({
      label: row.label,
      count: row.count,
      open: row.currentlyOpenCount,
      overdue: row.overdueCount,
    });
  }
  finishSheet(sheet);
}

function addValiditySheet(workbook: ExcelJS.Workbook, report: OpenAgingQuotationReportResult): void {
  const sheet = workbook.addWorksheet('Geçerlilik');
  sheet.columns = [
    { header: 'Geçerlilik grubu', key: 'label', width: 32 },
    { header: 'Toplam', key: 'count', width: 14 },
    { header: 'Halen açık', key: 'open', width: 16 },
    { header: 'Süresi dolmuş', key: 'overdue', width: 18 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.validityDistribution) {
    sheet.addRow({
      label: row.label,
      count: row.count,
      open: row.currentlyOpenCount,
      overdue: row.overdueCount,
    });
  }
  finishSheet(sheet);
}

function addSalespeopleSheet(workbook: ExcelJS.Workbook, report: OpenAgingQuotationReportResult): void {
  const sheet = workbook.addWorksheet('Personel');
  sheet.columns = [
    { header: 'Personel', key: 'name', width: 32 },
    { header: 'Odoo kullanıcı ID', key: 'id', width: 18 },
    { header: 'Takipte', key: 'tracked', width: 13 },
    { header: 'Halen açık', key: 'open', width: 15 },
    { header: 'Süresi dolmuş', key: 'overdue', width: 18 },
    { header: 'Yaklaşan', key: 'nearing', width: 14 },
    { header: 'Tarih eksik', key: 'missing', width: 15 },
    { header: 'En yaşlı (gün)', key: 'oldest', width: 17 },
    { header: 'Müşteri', key: 'customers', width: 13 },
    { header: 'Son teklif', key: 'last', width: 20 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.salespeople) {
    sheet.addRow({
      name: row.displayName,
      id: row.salespersonId ?? 'Atanmamış',
      tracked: row.metrics.trackedCount,
      open: row.metrics.currentlyOpenCount,
      overdue: row.metrics.overdueCount,
      nearing: row.metrics.nearingExpiryCount,
      missing: row.metrics.missingValidityCount,
      oldest: row.metrics.oldestAgeDays,
      customers: row.customerCount,
      last: row.lastQuotationDate ? new Date(row.lastQuotationDate) : null,
    });
  }
  sheet.getColumn('last').numFmt = 'dd.mm.yyyy hh:mm';
  finishSheet(sheet);
}

function addCustomersSheet(workbook: ExcelJS.Workbook, report: OpenAgingQuotationReportResult): void {
  const sheet = workbook.addWorksheet('Müşteriler');
  sheet.columns = [
    { header: 'Müşteri', key: 'name', width: 44 },
    { header: 'Odoo müşteri ID', key: 'id', width: 18 },
    { header: 'Takipte', key: 'tracked', width: 13 },
    { header: 'Halen açık', key: 'open', width: 15 },
    { header: 'Süresi dolmuş', key: 'overdue', width: 18 },
    { header: 'Yaklaşan', key: 'nearing', width: 14 },
    { header: 'Tarih eksik', key: 'missing', width: 15 },
    { header: 'En yaşlı (gün)', key: 'oldest', width: 17 },
    { header: 'Personel', key: 'salespeople', width: 13 },
    { header: 'Son teklif', key: 'last', width: 20 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.customers) {
    sheet.addRow({
      name: row.displayName,
      id: row.customerId,
      tracked: row.metrics.trackedCount,
      open: row.metrics.currentlyOpenCount,
      overdue: row.metrics.overdueCount,
      nearing: row.metrics.nearingExpiryCount,
      missing: row.metrics.missingValidityCount,
      oldest: row.metrics.oldestAgeDays,
      salespeople: row.salespersonCount,
      last: row.lastQuotationDate ? new Date(row.lastQuotationDate) : null,
    });
  }
  sheet.getColumn('last').numFmt = 'dd.mm.yyyy hh:mm';
  finishSheet(sheet);
}

function addDetailSheet(workbook: ExcelJS.Workbook, report: OpenAgingQuotationReportResult): void {
  const sheet = workbook.addWorksheet('Teklif Takibi');
  sheet.columns = [
    { header: 'Odoo ID', key: 'id', width: 12 },
    { header: 'Oluşturma', key: 'created', width: 20 },
    { header: 'Yaş (gün)', key: 'age', width: 13 },
    { header: 'Personel', key: 'salesperson', width: 30 },
    { header: 'Müşteri', key: 'customer', width: 44 },
    { header: 'Kaynak durum', key: 'sourceState', width: 17 },
    { header: 'Geçerlilik', key: 'validityDate', width: 16 },
    { header: 'Takip grubu', key: 'validityGroup', width: 26 },
    { header: 'Kalan/geçen gün', key: 'daysToExpiry', width: 18 },
    { header: 'Halen açık', key: 'currentlyOpen', width: 14 },
    { header: 'Tutar', key: 'amount', width: 18 },
    { header: 'Para birimi', key: 'currency', width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.details) {
    sheet.addRow({
      id: row.id,
      created: new Date(row.createDate),
      age: row.ageDays,
      salesperson: row.salespersonName,
      customer: row.customerName,
      sourceState: row.sourceState === 'sent' ? 'Gönderildi' : 'Taslak',
      validityDate: row.validityDate ? new Date(`${row.validityDate}T00:00:00.000Z`) : null,
      validityGroup: validityLabels[row.validityGroup] ?? row.validityGroup,
      daysToExpiry: row.daysToExpiry,
      currentlyOpen: row.currentlyOpen ? 'Evet' : 'Hayır',
      amount: Number(row.amountTotal),
      currency: row.currencyCode,
    });
  }
  sheet.getColumn('created').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn('validityDate').numFmt = 'dd.mm.yyyy';
  sheet.getColumn('amount').numFmt = '#,##0.00';
  finishSheet(sheet);
}

export function createOpenAgingExportFilename(report: OpenAgingQuotationReportResult): string {
  return `${sanitizeFilename(report.businessUnit.displayName)}_acik-yaslanan-teklifler_${report.asOfDate}.xlsx`;
}

export async function buildOpenAgingQuotationXlsx(
  report: OpenAgingQuotationReportResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ertip Report App';
  workbook.company = 'Er Tıbbi Ürünler';
  workbook.created = new Date(report.generatedAt);
  workbook.modified = new Date(report.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  addSummarySheet(workbook, report);
  addAgeSheet(workbook, report);
  addValiditySheet(workbook, report);
  addSalespeopleSheet(workbook, report);
  addCustomersSheet(workbook, report);
  addDetailSheet(workbook, report);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
