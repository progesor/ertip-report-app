import ExcelJS from 'exceljs';

import type { QuotationConversionReportResult } from '@ertip/reporting';

const trDateTime = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

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
  report: QuotationConversionReportResult,
): void {
  const sheet = workbook.addWorksheet('Özet');
  sheet.columns = [
    { header: 'Alan', key: 'field', width: 42 },
    { header: 'Değer', key: 'value', width: 60 },
  ];
  styleHeader(sheet.getRow(1));
  const salesperson =
    report.filters.salespersonId === null
      ? 'Tüm personel'
      : report.options.salespeople.find(({ id }) => id === report.filters.salespersonId)?.displayName ??
        `Odoo kullanıcı #${report.filters.salespersonId}`;
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
    ['Teklif kohort ekseni', 'sale.order.create_date'],
    ['Gerçekleşme ekseni', 'state=sale için sale.order.date_order'],
    ['Dönem başlangıcı', report.filters.dateFrom],
    ['Dönem bitişi (hariç)', report.filters.dateTo],
    ['Önceki dönem başlangıcı', report.previousPeriod.dateFrom],
    ['Önceki dönem bitişi (hariç)', report.previousPeriod.dateTo],
    ['Personel filtresi', salesperson],
    ['Müşteri filtresi', customer],
    ['Oluşturulma', formatDateTime(report.generatedAt)],
    ['Son senkronizasyon', formatDateTime(report.lastSyncAt)],
    ['Teklif sayısı', report.metrics.quotationCount],
    ['Siparişe dönüşen', report.metrics.convertedCount],
    ['Dönüşmeyen', report.metrics.notConvertedCount],
    ['Adet dönüşüm oranı', report.metrics.conversionRate ?? 0],
    ['Geçerli gecikme kaydı', report.metrics.validLagConvertedCount],
    ['Aynı ay dönüşen', report.metrics.sameMonthConvertedCount],
    ['Çapraz ay dönüşen', report.metrics.crossMonthConvertedCount],
    ['Ortalama gecikme günü', report.metrics.averageLagDays ?? 0],
    ['Medyan gecikme günü', report.metrics.medianLagDays ?? 0],
    ['P90 gecikme günü', report.metrics.p90LagDays ?? 0],
    ['Kaynak anomalisi', report.metrics.anomalyCount],
  ];
  for (const [field, value] of rows) sheet.addRow({ field, value });
  sheet.getColumn('field').font = { bold: true };
  sheet.getCell('B19').numFmt = '0.0%';
  finishSheet(sheet);
}

function addLagSheet(workbook: ExcelJS.Workbook, report: QuotationConversionReportResult): void {
  const sheet = workbook.addWorksheet('Gecikme Dağılımı');
  sheet.columns = [
    { header: 'Kod', key: 'code', width: 16 },
    { header: 'Aralık', key: 'label', width: 24 },
    { header: 'Kayıt', key: 'count', width: 14 },
    { header: 'Dönüşen içindeki pay', key: 'share', width: 24 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.lagDistribution) {
    sheet.addRow({ code: row.code, label: row.label, count: row.count, share: row.shareOfConverted });
  }
  sheet.getColumn('share').numFmt = '0.0%';
  finishSheet(sheet);
}

function addTrendSheet(workbook: ExcelJS.Workbook, report: QuotationConversionReportResult): void {
  const sheet = workbook.addWorksheet('Aylık Eğilim');
  sheet.columns = [
    { header: 'Teklif ayı', key: 'month', width: 16 },
    { header: 'Teklif', key: 'quotation', width: 14 },
    { header: 'Dönüşen', key: 'converted', width: 14 },
    { header: 'Dönüşmeyen', key: 'notConverted', width: 16 },
    { header: 'Dönüşüm', key: 'conversion', width: 16 },
    { header: 'Ortalama gün', key: 'averageLag', width: 16 },
    { header: 'Medyan gün', key: 'medianLag', width: 16 },
    { header: 'P90 gün', key: 'p90Lag', width: 14 },
    { header: 'Aynı ay', key: 'sameMonth', width: 14 },
    { header: 'Çapraz ay', key: 'crossMonth', width: 14 },
    { header: 'Anomali', key: 'anomaly', width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.trend) {
    sheet.addRow({
      month: row.month,
      quotation: row.metrics.quotationCount,
      converted: row.metrics.convertedCount,
      notConverted: row.metrics.notConvertedCount,
      conversion: row.metrics.conversionRate,
      averageLag: row.metrics.averageLagDays,
      medianLag: row.metrics.medianLagDays,
      p90Lag: row.metrics.p90LagDays,
      sameMonth: row.metrics.sameMonthConvertedCount,
      crossMonth: row.metrics.crossMonthConvertedCount,
      anomaly: row.metrics.anomalyCount,
    });
  }
  sheet.getColumn('conversion').numFmt = '0.0%';
  finishSheet(sheet);
}

function addDimensionSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  idHeader: string,
  rows: QuotationConversionReportResult['salespeople'] | QuotationConversionReportResult['customers'],
): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [
    { header: name === 'Personel' ? 'Personel' : 'Müşteri', key: 'name', width: 40 },
    { header: idHeader, key: 'id', width: 18 },
    { header: 'Teklif', key: 'quotation', width: 14 },
    { header: 'Dönüşen', key: 'converted', width: 14 },
    { header: 'Dönüşüm', key: 'conversion', width: 16 },
    { header: 'Ortalama gün', key: 'averageLag', width: 16 },
    { header: 'Medyan gün', key: 'medianLag', width: 16 },
    { header: 'Aynı ay', key: 'sameMonth', width: 14 },
    { header: 'Çapraz ay', key: 'crossMonth', width: 14 },
    { header: 'Anomali', key: 'anomaly', width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow({
      name: row.displayName,
      id: row.id,
      quotation: row.metrics.quotationCount,
      converted: row.metrics.convertedCount,
      conversion: row.metrics.conversionRate,
      averageLag: row.metrics.averageLagDays,
      medianLag: row.metrics.medianLagDays,
      sameMonth: row.metrics.sameMonthConvertedCount,
      crossMonth: row.metrics.crossMonthConvertedCount,
      anomaly: row.metrics.anomalyCount,
    });
  }
  sheet.getColumn('conversion').numFmt = '0.0%';
  finishSheet(sheet);
}

function addDetailSheet(workbook: ExcelJS.Workbook, report: QuotationConversionReportResult): void {
  const sheet = workbook.addWorksheet('Teklif Detayı');
  sheet.columns = [
    { header: 'Odoo ID', key: 'id', width: 12 },
    { header: 'Teklif tarihi', key: 'created', width: 20 },
    { header: 'Gerçekleşme tarihi', key: 'confirmed', width: 20 },
    { header: 'Personel', key: 'salesperson', width: 30 },
    { header: 'Odoo kullanıcı ID', key: 'salespersonId', width: 18 },
    { header: 'Müşteri', key: 'customer', width: 40 },
    { header: 'Odoo müşteri ID', key: 'customerId', width: 18 },
    { header: 'Kaynak durum', key: 'sourceState', width: 16 },
    { header: 'Dönüştü', key: 'converted', width: 12 },
    { header: 'Gecikme günü', key: 'lagDays', width: 16 },
    { header: 'Ay ilişkisi', key: 'relation', width: 18 },
    { header: 'Gecikme aralığı', key: 'bucket', width: 18 },
    { header: 'Anomali kodu', key: 'anomaly', width: 34 },
    { header: 'Tutar', key: 'amount', width: 18 },
    { header: 'Para birimi', key: 'currency', width: 14 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of report.details) {
    sheet.addRow({
      id: row.id,
      created: new Date(row.createDate),
      confirmed: row.converted ? new Date(row.dateOrder) : null,
      salesperson: row.salespersonName,
      salespersonId: row.salespersonId,
      customer: row.customerName,
      customerId: row.customerId,
      sourceState: row.sourceState,
      converted: row.converted ? 'Evet' : 'Hayır',
      lagDays: row.lagDays,
      relation: row.dateRelation,
      bucket: row.lagBucket,
      anomaly: row.anomalyCode,
      amount: Number(row.amountTotal),
      currency: row.currencyCode,
    });
  }
  sheet.getColumn('created').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn('confirmed').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn('amount').numFmt = '#,##0.00';
  finishSheet(sheet);
}

export function createQuotationConversionExportFilename(
  report: QuotationConversionReportResult,
): string {
  return `${sanitizeFilename(report.businessUnit.displayName)}_teklif-siparis-donusumu_${report.filters.dateFrom}_${report.filters.dateTo}.xlsx`;
}

export async function buildQuotationConversionXlsx(
  report: QuotationConversionReportResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ertip Report App';
  workbook.company = 'Er Tıbbi Ürünler';
  workbook.created = new Date(report.generatedAt);
  workbook.modified = new Date(report.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  addSummarySheet(workbook, report);
  addLagSheet(workbook, report);
  addTrendSheet(workbook, report);
  addDimensionSheet(workbook, 'Personel', 'Odoo kullanıcı ID', report.salespeople);
  addDimensionSheet(workbook, 'Müşteri', 'Odoo müşteri ID', report.customers);
  addDetailSheet(workbook, report);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
