import { existsSync } from 'node:fs';

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import type {
  MonthlyQuotationDetailRow,
  MonthlyQuotationReportResult,
  MonthlyQuotationSalespersonRow,
} from '@ertip/reporting';

export type MonthlyQuotationPdfScope = 'all' | 'salesperson';

const trNumber = new Intl.NumberFormat('tr-TR');
const trDecimal = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const trDate = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const trDateTime = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const statusLabels: Readonly<Record<string, string>> = {
  realized: 'Gerçekleşen',
  open: 'Açık',
  expired: 'Süresi doldu',
  cancelled: 'İptal',
  unknown: 'Belirsiz',
};

function formatPercent(value: number | null): string {
  return value === null ? '—' : `%${trDecimal.format(value * 100)}`;
}

function formatDate(value: string | null): string {
  return value ? trDate.format(new Date(value)) : '—';
}

function formatDateTime(value: string | null): string {
  return value ? trDateTime.format(new Date(value)) : '—';
}

function transliterateTurkish(value: string): string {
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
    .replaceAll('ü', 'u');
}

function sanitizeFilename(value: string): string {
  return transliterateTurkish(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase();
}

export function createMonthlyQuotationExportFilename(input: {
  readonly report: MonthlyQuotationReportResult;
  readonly extension: 'xlsx' | 'pdf';
  readonly scope?: MonthlyQuotationPdfScope;
}): string {
  const scope =
    input.scope === 'salesperson'
      ? 'personel'
      : input.scope === 'all'
        ? 'tum-personel'
        : 'rapor';

  return `${[
    sanitizeFilename(input.report.businessUnit.displayName),
    'aylik-teklif-performansi',
    input.report.filters.dateFrom,
    input.report.filters.dateTo,
    scope,
  ].join('_')}.${input.extension}`;
}

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF182638' } };
  row.alignment = { vertical: 'middle' };
}

function setWorksheetDefaults(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: 'A1',
    to: sheet.getCell(1, Math.max(1, sheet.columnCount)).address,
  };
  sheet.getRow(1).height = 24;
}

function addMetadataSheet(
  workbook: ExcelJS.Workbook,
  report: MonthlyQuotationReportResult,
): void {
  const sheet = workbook.addWorksheet('Özet');
  sheet.columns = [
    { header: 'Alan', key: 'field', width: 34 },
    { header: 'Değer', key: 'value', width: 48 },
  ];
  styleHeader(sheet.getRow(1));

  const rows: readonly [string, string | number][] = [
    ['Rapor', report.definition.name],
    ['Rapor sürümü', report.definition.version],
    ['Metrik sürümü', report.definition.metricVersion],
    ['İş birimi', report.businessUnit.displayName],
    ['Ana para birimi', report.businessUnit.currencyCode],
    ['Başlangıç', report.filters.dateFrom],
    ['Bitiş (hariç)', report.filters.dateTo],
    ['Oluşturulma', formatDateTime(report.generatedAt)],
    ['Son senkronizasyon', formatDateTime(report.lastSyncAt)],
    ['Toplam teklif', report.metrics.quotationCount],
    ['Gerçekleşen', report.metrics.realizedCount],
    ['Açık', report.metrics.openCount],
    ['Süresi doldu', report.metrics.expiredCount],
    ['İptal', report.metrics.cancelledCount],
    ['Gerçekleşmeyen', report.metrics.notRealizedCount],
    ['Dönüşüm oranı', formatPercent(report.metrics.conversionRate)],
    ['Teklif verilen müşteri', report.metrics.quotedCustomerCount],
    ['Geçerlilik tarihi boş açık teklif', report.openWithoutValidityCount],
  ];

  for (const [field, value] of rows) {
    sheet.addRow({ field, value });
  }

  sheet.getColumn('field').font = { bold: true };
  setWorksheetDefaults(sheet);
}

function addPersonnelSheet(
  workbook: ExcelJS.Workbook,
  report: MonthlyQuotationReportResult,
): void {
  const sheet = workbook.addWorksheet('Personel');
  sheet.columns = [
    { header: 'Personel', key: 'name', width: 32 },
    { header: 'Odoo kullanıcı ID', key: 'id', width: 18 },
    { header: 'Teklif', key: 'quotation', width: 12 },
    { header: 'Gerçekleşen', key: 'realized', width: 14 },
    { header: 'Açık', key: 'open', width: 12 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 18 },
    { header: 'Dönüşüm', key: 'conversion', width: 14 },
    { header: 'Müşteri', key: 'customers', width: 12 },
    { header: 'Son teklif', key: 'last', width: 16 },
  ];
  styleHeader(sheet.getRow(1));

  for (const row of report.salespeople) {
    sheet.addRow({
      name: row.displayName,
      id: row.salespersonId ?? 'Atanmamış',
      quotation: row.metrics.quotationCount,
      realized: row.metrics.realizedCount,
      open: row.metrics.openCount,
      notRealized: row.metrics.notRealizedCount,
      conversion: row.metrics.conversionRate,
      customers: row.metrics.quotedCustomerCount,
      last: row.lastQuotationDate ? new Date(row.lastQuotationDate) : null,
    });
  }

  sheet.getColumn('conversion').numFmt = '0.0%';
  sheet.getColumn('last').numFmt = 'dd.mm.yyyy';
  setWorksheetDefaults(sheet);
}

function addCustomerSheet(
  workbook: ExcelJS.Workbook,
  report: MonthlyQuotationReportResult,
): void {
  const sheet = workbook.addWorksheet('Müşteriler');
  sheet.columns = [
    { header: 'Müşteri', key: 'name', width: 42 },
    { header: 'Odoo müşteri ID', key: 'id', width: 18 },
    { header: 'Teklif', key: 'quotation', width: 12 },
    { header: 'Gerçekleşen', key: 'realized', width: 14 },
    { header: 'Açık', key: 'open', width: 12 },
    { header: 'Gerçekleşmeyen', key: 'notRealized', width: 18 },
    { header: 'Dönüşüm', key: 'conversion', width: 14 },
    { header: 'Son teklif', key: 'last', width: 16 },
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
      last: row.lastQuotationDate ? new Date(row.lastQuotationDate) : null,
    });
  }

  sheet.getColumn('conversion').numFmt = '0.0%';
  sheet.getColumn('last').numFmt = 'dd.mm.yyyy';
  setWorksheetDefaults(sheet);
}

function addDetailSheet(
  workbook: ExcelJS.Workbook,
  report: MonthlyQuotationReportResult,
): void {
  const sheet = workbook.addWorksheet('Teklif Detayı');
  sheet.columns = [
    { header: 'Odoo ID', key: 'id', width: 12 },
    { header: 'Oluşturma', key: 'created', width: 20 },
    { header: 'Sipariş tarihi', key: 'ordered', width: 20 },
    { header: 'Personel', key: 'salesperson', width: 30 },
    { header: 'Müşteri', key: 'customer', width: 42 },
    { header: 'Durum', key: 'status', width: 18 },
    { header: 'Geçerlilik', key: 'validity', width: 16 },
    { header: 'Tutar', key: 'amount', width: 16 },
    { header: 'Para birimi', key: 'currency', width: 14 },
  ];
  styleHeader(sheet.getRow(1));

  for (const row of report.details) {
    sheet.addRow({
      id: row.id,
      created: new Date(row.createDate),
      ordered: new Date(row.dateOrder),
      salesperson: row.salespersonName,
      customer: row.customerName,
      status: statusLabels[row.normalizedStatus] ?? row.normalizedStatus,
      validity: row.validityDate
        ? new Date(`${row.validityDate}T00:00:00.000Z`)
        : null,
      amount: Number(row.amountTotal),
      currency: row.currencyCode,
    });
  }

  sheet.getColumn('created').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn('ordered').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn('validity').numFmt = 'dd.mm.yyyy';
  sheet.getColumn('amount').numFmt = '#,##0.00';
  setWorksheetDefaults(sheet);
}

export async function buildMonthlyQuotationXlsx(
  report: MonthlyQuotationReportResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ertip Report App';
  workbook.company = 'Er Tıbbi Ürünler';
  workbook.created = new Date(report.generatedAt);
  workbook.modified = new Date(report.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  addMetadataSheet(workbook, report);
  addPersonnelSheet(workbook, report);
  addCustomerSheet(workbook, report);
  addDetailSheet(workbook, report);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function resolvePdfFont(): string | null {
  const candidates = [
    process.env.REPORT_PDF_FONT_PATH,
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function createPdfTextFormatter(hasUnicodeFont: boolean): (value: string) => string {
  return hasUnicodeFont
    ? (value) => value
    : (value) =>
        transliterateTurkish(value)
          .replaceAll('—', '-')
          .replaceAll('·', '-')
          .replaceAll('•', '-');
}

function ensurePdfSpace(doc: PDFKit.PDFDocument, height: number): boolean {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) {
    return false;
  }

  doc.addPage();
  return true;
}

function writePdfTitle(
  doc: PDFKit.PDFDocument,
  report: MonthlyQuotationReportResult,
  pdfText: (value: string) => string,
): void {
  doc.fontSize(18).fillColor('#182638').text(pdfText(report.definition.name));
  doc.moveDown(0.25);
  doc
    .fontSize(9)
    .fillColor('#445466')
    .text(
      pdfText(
        `${report.businessUnit.displayName} · ${report.filters.dateFrom} – ${report.filters.dateTo} (bitiş hariç) · Oluşturulma: ${formatDateTime(report.generatedAt)}`,
      ),
    );
  doc.moveDown(0.6);
}

function writeMetricGrid(
  doc: PDFKit.PDFDocument,
  report: MonthlyQuotationReportResult,
  pdfText: (value: string) => string,
): void {
  const metrics = [
    ['Toplam Teklif', trNumber.format(report.metrics.quotationCount)],
    ['Gerçekleşen', trNumber.format(report.metrics.realizedCount)],
    ['Açık', trNumber.format(report.metrics.openCount)],
    ['Gerçekleşmeyen', trNumber.format(report.metrics.notRealizedCount)],
    ['Dönüşüm', formatPercent(report.metrics.conversionRate)],
    ['Müşteri', trNumber.format(report.metrics.quotedCustomerCount)],
  ] as const;
  const startX = doc.x;
  const startY = doc.y;
  const width = 120;
  const height = 42;

  metrics.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = startX + column * (width + 10);
    const y = startY + row * (height + 8);
    doc.roundedRect(x, y, width, height, 4).fillAndStroke('#F1F4F7', '#D6DEE6');
    doc
      .fillColor('#526577')
      .fontSize(8)
      .text(pdfText(label), x + 8, y + 7, { width: width - 16 });
    doc
      .fillColor('#182638')
      .fontSize(15)
      .text(pdfText(value), x + 8, y + 20, { width: width - 16 });
  });

  doc.x = startX;
  doc.y = startY + 2 * (height + 8) + 4;
}

function writeTableHeader(
  doc: PDFKit.PDFDocument,
  columns: readonly string[],
  widths: readonly number[],
  pdfText: (value: string) => string,
): void {
  const x = doc.x;
  const y = doc.y;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  doc.rect(x, y, totalWidth, 18).fill('#182638');
  let cursor = x;

  columns.forEach((column, index) => {
    const width = widths[index] ?? 40;
    doc
      .fillColor('#FFFFFF')
      .fontSize(7)
      .text(pdfText(column), cursor + 3, y + 5, { width: width - 6 });
    cursor += width;
  });

  doc.y = y + 20;
}

function writeDetailRows(
  doc: PDFKit.PDFDocument,
  details: readonly MonthlyQuotationDetailRow[],
  maximumRows: number | null,
  pdfText: (value: string) => string,
): void {
  const selected = maximumRows === null ? details : details.slice(0, maximumRows);
  const widths = [44, 66, 90, 145, 65, 65];
  const headers = ['ID', 'Tarih', 'Personel', 'Müşteri', 'Durum', 'Tutar'];
  writeTableHeader(doc, headers, widths, pdfText);

  for (const row of selected) {
    if (ensurePdfSpace(doc, 24)) {
      writeTableHeader(doc, headers, widths, pdfText);
    }

    const x = doc.x;
    const y = doc.y;
    const values = [
      `#${row.id}`,
      formatDate(row.createDate),
      row.salespersonName,
      row.customerName,
      statusLabels[row.normalizedStatus] ?? row.normalizedStatus,
      `${trDecimal.format(Number(row.amountTotal))} ${row.currencyCode}`,
    ];
    let cursor = x;

    values.forEach((value, index) => {
      const width = widths[index] ?? 40;
      doc
        .fillColor('#182638')
        .fontSize(6.6)
        .text(pdfText(value), cursor + 3, y + 4, {
          width: width - 6,
          height: 16,
          ellipsis: true,
        });
      cursor += width;
    });

    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    doc
      .moveTo(x, y + 20)
      .lineTo(x + totalWidth, y + 20)
      .strokeColor('#DDE4EA')
      .stroke();
    doc.y = y + 22;
  }

  if (maximumRows !== null && details.length > maximumRows) {
    doc
      .moveDown(0.4)
      .fontSize(7)
      .fillColor('#526577')
      .text(
        pdfText(
          `Bu toplu PDF’de son ${trNumber.format(maximumRows)} teklif gösterildi; toplam ${trNumber.format(details.length)} kayıt XLSX çıktısında eksiksiz yer alır.`,
        ),
      );
  }
}

function groupTopCustomers(
  details: readonly MonthlyQuotationDetailRow[],
): readonly [string, number][] {
  const counts = new Map<string, number>();

  for (const detail of details) {
    counts.set(detail.customerName, (counts.get(detail.customerName) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(
      (left, right) =>
        right[1] - left[1] || left[0].localeCompare(right[0], 'tr'),
    )
    .slice(0, 10);
}

function writeSalespersonSection(
  doc: PDFKit.PDFDocument,
  salesperson: MonthlyQuotationSalespersonRow,
  details: readonly MonthlyQuotationDetailRow[],
  includeAllDetails: boolean,
  pdfText: (value: string) => string,
): void {
  doc.addPage();
  doc.fontSize(16).fillColor('#182638').text(pdfText(salesperson.displayName));
  doc
    .fontSize(8)
    .fillColor('#526577')
    .text(
      pdfText(
        salesperson.salespersonId === null
          ? 'Atanmamış personel kovası'
          : `Odoo kullanıcı #${salesperson.salespersonId}`,
      ),
    );
  doc.moveDown(0.6);
  doc
    .fontSize(9)
    .fillColor('#182638')
    .text(
      pdfText(
        [
          `Teklif: ${trNumber.format(salesperson.metrics.quotationCount)}`,
          `Gerçekleşen: ${trNumber.format(salesperson.metrics.realizedCount)}`,
          `Açık: ${trNumber.format(salesperson.metrics.openCount)}`,
          `Gerçekleşmeyen: ${trNumber.format(salesperson.metrics.notRealizedCount)}`,
          `Dönüşüm: ${formatPercent(salesperson.metrics.conversionRate)}`,
          `Müşteri: ${trNumber.format(salesperson.metrics.quotedCustomerCount)}`,
        ].join(' · '),
      ),
    );
  doc.moveDown(0.8);
  doc.fontSize(10).fillColor('#182638').text(pdfText('En yoğun müşteriler'));

  for (const [customer, count] of groupTopCustomers(details)) {
    doc
      .fontSize(7.5)
      .fillColor('#445466')
      .text(pdfText(`• ${customer}: ${trNumber.format(count)} teklif`));
  }

  doc.moveDown(0.7);
  doc.fontSize(10).fillColor('#182638').text(pdfText('Teklif detayı'));
  doc.moveDown(0.35);
  writeDetailRows(doc, details, includeAllDetails ? null : 25, pdfText);
}

function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function buildMonthlyQuotationPdf(input: {
  readonly report: MonthlyQuotationReportResult;
  readonly scope: MonthlyQuotationPdfScope;
}): Promise<Buffer> {
  const doc = new PDFDocument({
    autoFirstPage: true,
    layout: 'landscape',
    margin: 32,
    size: 'A4',
    info: {
      Title: input.report.definition.name,
      Author: 'Ertip Report App',
      Subject: `${input.report.businessUnit.displayName} teklif performansı`,
    },
  });
  const output = collectPdfBuffer(doc);
  const font = resolvePdfFont();
  const pdfText = createPdfTextFormatter(font !== null);

  if (font) {
    doc.font(font);
  }

  writePdfTitle(doc, input.report, pdfText);
  writeMetricGrid(doc, input.report, pdfText);
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('#182638').text(pdfText('Personel karşılaştırması'));
  doc.moveDown(0.3);

  const widths = [160, 55, 65, 55, 75, 65];
  const headers = ['Personel', 'Teklif', 'Gerç.', 'Açık', 'Gerç. değil', 'Dönüşüm'];
  writeTableHeader(doc, headers, widths, pdfText);

  for (const row of input.report.salespeople) {
    if (ensurePdfSpace(doc, 22)) {
      writeTableHeader(doc, headers, widths, pdfText);
    }

    const x = doc.x;
    const y = doc.y;
    const values = [
      row.displayName,
      trNumber.format(row.metrics.quotationCount),
      trNumber.format(row.metrics.realizedCount),
      trNumber.format(row.metrics.openCount),
      trNumber.format(row.metrics.notRealizedCount),
      formatPercent(row.metrics.conversionRate),
    ];
    let cursor = x;

    values.forEach((value, index) => {
      const width = widths[index] ?? 40;
      doc
        .fontSize(7)
        .fillColor('#182638')
        .text(pdfText(value), cursor + 3, y + 4, {
          width: width - 6,
          height: 15,
          ellipsis: true,
        });
      cursor += width;
    });
    doc.y = y + 20;
  }

  const selectedSalespeople =
    input.scope === 'salesperson'
      ? input.report.salespeople.slice(0, 1)
      : input.report.salespeople;

  for (const salesperson of selectedSalespeople) {
    const details = input.report.details.filter(
      ({ salespersonId }) => salespersonId === salesperson.salespersonId,
    );
    writeSalespersonSection(
      doc,
      salesperson,
      details,
      input.scope === 'salesperson',
      pdfText,
    );
  }

  doc.end();
  return output;
}

export function withCompleteMonthlyQuotationDetails(
  report: MonthlyQuotationReportResult,
  details: readonly MonthlyQuotationDetailRow[],
): MonthlyQuotationReportResult {
  return {
    ...report,
    details,
    detailTotalCount: details.length,
    detailLimit: details.length,
    detailsTruncated: false,
  };
}
