import { existsSync } from 'node:fs';

import PDFDocument from 'pdfkit';

import type {
  MonthlyQuotationDetailRow,
  MonthlyQuotationReportResult,
  MonthlyQuotationSalespersonRow,
} from '@ertip/reporting';

export type MonthlyQuotationPdfScope = 'all' | 'salesperson';

type TextAlign = 'left' | 'center' | 'right';

interface RegisteredFonts {
  readonly regular: string;
  readonly bold: string;
  readonly unicode: boolean;
}

interface TableColumn {
  readonly label: string;
  readonly width: number;
  readonly align: TextAlign;
}

interface MetricItem {
  readonly label: string;
  readonly value: string;
  readonly accent: string;
}

const PAGE_LEFT = 36;
const PAGE_TOP = 30;
const PAGE_RIGHT = 36;
const PAGE_BOTTOM = 34;
const HEADER_NAVY = '#16283C';
const TEXT_NAVY = '#17293D';
const MUTED_TEXT = '#52677A';
const BORDER = '#D6E0E8';
const PANEL = '#F3F6F8';
const ROW_ALT = '#F8FAFB';
const GREEN = '#2F8A63';
const AMBER = '#B7791F';
const RED = '#B94A48';
const CYAN = '#277B91';

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

function resolveFontPath(candidates: readonly (string | undefined)[]): string | null {
  return (
    candidates
      .filter((candidate): candidate is string => Boolean(candidate))
      .find((candidate) => existsSync(candidate)) ?? null
  );
}

function registerFonts(doc: PDFKit.PDFDocument): RegisteredFonts {
  const regularPath = resolveFontPath([
    process.env.REPORT_PDF_FONT_PATH,
    '/app/fonts/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
  ]);
  const boldPath = resolveFontPath([
    process.env.REPORT_PDF_FONT_BOLD_PATH,
    '/app/fonts/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
  ]);

  if (!regularPath) {
    return { regular: 'Helvetica', bold: 'Helvetica-Bold', unicode: false };
  }

  doc.registerFont('ErtipPdfRegular', regularPath);
  doc.registerFont('ErtipPdfBold', boldPath ?? regularPath);
  return { regular: 'ErtipPdfRegular', bold: 'ErtipPdfBold', unicode: true };
}

function createPdfTextFormatter(unicode: boolean): (value: string) => string {
  return unicode
    ? (value) => value
    : (value) =>
        transliterateTurkish(value)
          .replaceAll('—', '-')
          .replaceAll('–', '-')
          .replaceAll('·', '-')
          .replaceAll('•', '-');
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - PAGE_LEFT - PAGE_RIGHT;
}

function selectFont(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  size: number,
  bold: boolean,
): void {
  doc.font(bold ? fonts.bold : fonts.regular).fontSize(size);
}

function fitText(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  value: string,
  width: number,
  size: number,
  bold: boolean,
): string {
  selectFont(doc, fonts, size, bold);
  const normalized = pdfText(value);

  if (doc.widthOfString(normalized) <= width) {
    return normalized;
  }

  const suffix = '...';
  let end = normalized.length;

  while (end > 1 && doc.widthOfString(`${normalized.slice(0, end)}${suffix}`) > width) {
    end -= 1;
  }

  return `${normalized.slice(0, Math.max(1, end))}${suffix}`;
}

function drawText(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  value: string,
  x: number,
  y: number,
  width: number,
  size: number,
  bold = false,
  color = TEXT_NAVY,
  align: TextAlign = 'left',
): void {
  const fitted = fitText(doc, fonts, pdfText, value, width, size, bold);
  selectFont(doc, fonts, size, bold);
  doc.fillColor(color).text(fitted, x, y, {
    width,
    height: size + 5,
    align,
    lineBreak: false,
  });
}

function drawReportHeader(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  report: MonthlyQuotationReportResult,
  title: string,
  badge: string,
): number {
  const width = contentWidth(doc);
  drawText(doc, fonts, pdfText, badge.toUpperCase(), PAGE_LEFT, PAGE_TOP, width, 7, true, CYAN);
  drawText(doc, fonts, pdfText, title, PAGE_LEFT, PAGE_TOP + 14, width, 18, true);
  drawText(
    doc,
    fonts,
    pdfText,
    `${report.businessUnit.displayName} · ${report.filters.dateFrom} – ${report.filters.dateTo} (bitiş hariç) · Oluşturulma: ${formatDateTime(report.generatedAt)}`,
    PAGE_LEFT,
    PAGE_TOP + 42,
    width,
    8,
    false,
    MUTED_TEXT,
  );
  doc
    .moveTo(PAGE_LEFT, PAGE_TOP + 62)
    .lineTo(PAGE_LEFT + width, PAGE_TOP + 62)
    .strokeColor(BORDER)
    .lineWidth(0.8)
    .stroke();
  return PAGE_TOP + 78;
}

function drawMetricCards(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  metrics: readonly MetricItem[],
  y: number,
): number {
  const gap = 8;
  const width = (contentWidth(doc) - gap * (metrics.length - 1)) / metrics.length;
  const height = 54;

  metrics.forEach((metric, index) => {
    const x = PAGE_LEFT + index * (width + gap);
    doc.roundedRect(x, y, width, height, 5).fillAndStroke(PANEL, BORDER);
    doc.rect(x, y, width, 3).fill(metric.accent);
    drawText(doc, fonts, pdfText, metric.label, x + 9, y + 11, width - 18, 7, false, MUTED_TEXT);
    drawText(doc, fonts, pdfText, metric.value, x + 9, y + 27, width - 18, 15, true);
  });

  return y + height + 16;
}

function reportMetrics(report: MonthlyQuotationReportResult): readonly MetricItem[] {
  return [
    { label: 'Toplam Teklif', value: trNumber.format(report.metrics.quotationCount), accent: CYAN },
    { label: 'Gerçekleşen', value: trNumber.format(report.metrics.realizedCount), accent: GREEN },
    { label: 'Açık', value: trNumber.format(report.metrics.openCount), accent: AMBER },
    {
      label: 'Gerçekleşmeyen',
      value: trNumber.format(report.metrics.notRealizedCount),
      accent: RED,
    },
    { label: 'Dönüşüm', value: formatPercent(report.metrics.conversionRate), accent: GREEN },
    { label: 'Müşteri', value: trNumber.format(report.metrics.quotedCustomerCount), accent: CYAN },
  ];
}

function salespersonMetrics(row: MonthlyQuotationSalespersonRow): readonly MetricItem[] {
  return [
    { label: 'Toplam Teklif', value: trNumber.format(row.metrics.quotationCount), accent: CYAN },
    { label: 'Gerçekleşen', value: trNumber.format(row.metrics.realizedCount), accent: GREEN },
    { label: 'Açık', value: trNumber.format(row.metrics.openCount), accent: AMBER },
    {
      label: 'Gerçekleşmeyen',
      value: trNumber.format(row.metrics.notRealizedCount),
      accent: RED,
    },
    { label: 'Dönüşüm', value: formatPercent(row.metrics.conversionRate), accent: GREEN },
    { label: 'Müşteri', value: trNumber.format(row.metrics.quotedCustomerCount), accent: CYAN },
  ];
}

function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  title: string,
  y: number,
): number {
  drawText(doc, fonts, pdfText, title, PAGE_LEFT, y, contentWidth(doc), 10, true);
  return y + 20;
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  columns: readonly TableColumn[],
  y: number,
): number {
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  doc.rect(PAGE_LEFT, y, totalWidth, 22).fill(HEADER_NAVY);
  let x = PAGE_LEFT;

  for (const column of columns) {
    drawText(
      doc,
      fonts,
      pdfText,
      column.label,
      x + 6,
      y + 6,
      column.width - 12,
      7,
      true,
      '#FFFFFF',
      column.align,
    );
    x += column.width;
  }

  return y + 22;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  columns: readonly TableColumn[],
  values: readonly string[],
  y: number,
  index: number,
): number {
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const rowHeight = 23;

  if (index % 2 === 1) {
    doc.rect(PAGE_LEFT, y, totalWidth, rowHeight).fill(ROW_ALT);
  }

  let x = PAGE_LEFT;
  columns.forEach((column, columnIndex) => {
    drawText(
      doc,
      fonts,
      pdfText,
      values[columnIndex] ?? '—',
      x + 6,
      y + 7,
      column.width - 12,
      7,
      false,
      TEXT_NAVY,
      column.align,
    );
    x += column.width;
  });
  doc
    .moveTo(PAGE_LEFT, y + rowHeight)
    .lineTo(PAGE_LEFT + totalWidth, y + rowHeight)
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();
  return y + rowHeight;
}

function drawOverviewPage(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  report: MonthlyQuotationReportResult,
): void {
  let y = drawReportHeader(doc, fonts, pdfText, report, report.definition.name, 'Yönetim özeti');
  y = drawMetricCards(doc, fonts, pdfText, reportMetrics(report), y);
  y = drawSectionTitle(doc, fonts, pdfText, 'Personel karşılaştırması', y);

  const columns: readonly TableColumn[] = [
    { label: 'Personel', width: 240, align: 'left' },
    { label: 'Teklif', width: 75, align: 'right' },
    { label: 'Gerçekleşen', width: 90, align: 'right' },
    { label: 'Açık', width: 70, align: 'right' },
    { label: 'Gerçekleşmeyen', width: 110, align: 'right' },
    { label: 'Dönüşüm', width: 90, align: 'right' },
    { label: 'Müşteri', width: 90, align: 'right' },
  ];
  y = drawTableHeader(doc, fonts, pdfText, columns, y);

  report.salespeople.forEach((row, index) => {
    y = drawTableRow(
      doc,
      fonts,
      pdfText,
      columns,
      [
        row.displayName,
        trNumber.format(row.metrics.quotationCount),
        trNumber.format(row.metrics.realizedCount),
        trNumber.format(row.metrics.openCount),
        trNumber.format(row.metrics.notRealizedCount),
        formatPercent(row.metrics.conversionRate),
        trNumber.format(row.metrics.quotedCustomerCount),
      ],
      y,
      index,
    );
  });

  drawText(
    doc,
    fonts,
    pdfText,
    'Not: Tutarlar kaynak para biriminde gösterilir; farklı para birimleri tek toplamda birleştirilmez.',
    PAGE_LEFT,
    Math.min(y + 16, doc.page.height - PAGE_BOTTOM - 28),
    contentWidth(doc),
    7,
    false,
    MUTED_TEXT,
  );
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

function drawTopCustomers(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  details: readonly MonthlyQuotationDetailRow[],
  y: number,
): number {
  const panelHeight = 98;
  const width = contentWidth(doc);
  const columnGap = 20;
  const columnWidth = (width - 24 - columnGap) / 2;
  const customers = groupTopCustomers(details);
  doc.roundedRect(PAGE_LEFT, y, width, panelHeight, 5).fillAndStroke(PANEL, BORDER);
  drawText(doc, fonts, pdfText, 'En yoğun müşteriler', PAGE_LEFT + 12, y + 10, width - 24, 9, true);

  if (customers.length === 0) {
    drawText(
      doc,
      fonts,
      pdfText,
      'Bu kapsamda müşteri kaydı yok.',
      PAGE_LEFT + 12,
      y + 34,
      width - 24,
      7,
      false,
      MUTED_TEXT,
    );
    return y + panelHeight + 14;
  }

  customers.forEach(([customer, count], index) => {
    const column = Math.floor(index / 5);
    const row = index % 5;
    drawText(
      doc,
      fonts,
      pdfText,
      `• ${customer} · ${trNumber.format(count)} teklif`,
      PAGE_LEFT + 12 + column * (columnWidth + columnGap),
      y + 32 + row * 12,
      columnWidth,
      7,
      false,
      MUTED_TEXT,
    );
  });

  return y + panelHeight + 14;
}

function drawPersonContinuationHeader(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  report: MonthlyQuotationReportResult,
  salesperson: MonthlyQuotationSalespersonRow,
): number {
  drawText(doc, fonts, pdfText, salesperson.displayName, PAGE_LEFT, PAGE_TOP, 420, 14, true);
  drawText(
    doc,
    fonts,
    pdfText,
    `${report.filters.dateFrom} – ${report.filters.dateTo} · Teklif detayının devamı`,
    PAGE_LEFT,
    PAGE_TOP + 24,
    contentWidth(doc),
    7,
    false,
    MUTED_TEXT,
  );
  return PAGE_TOP + 48;
}

function drawDetailTable(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  report: MonthlyQuotationReportResult,
  salesperson: MonthlyQuotationSalespersonRow,
  details: readonly MonthlyQuotationDetailRow[],
  maximumRows: number | null,
  initialY: number,
): void {
  const selected = maximumRows === null ? details : details.slice(0, maximumRows);
  const columns: readonly TableColumn[] = [
    { label: 'ID', width: 55, align: 'left' },
    { label: 'Tarih', width: 82, align: 'left' },
    { label: 'Müşteri', width: 300, align: 'left' },
    { label: 'Durum', width: 120, align: 'left' },
    { label: 'Tutar', width: 150, align: 'right' },
  ];
  let y = drawTableHeader(doc, fonts, pdfText, columns, initialY);

  selected.forEach((row, index) => {
    if (y + 23 > doc.page.height - PAGE_BOTTOM) {
      doc.addPage();
      y = drawPersonContinuationHeader(doc, fonts, pdfText, report, salesperson);
      y = drawTableHeader(doc, fonts, pdfText, columns, y);
    }

    y = drawTableRow(
      doc,
      fonts,
      pdfText,
      columns,
      [
        `#${row.id}`,
        formatDate(row.createDate),
        row.customerName,
        statusLabels[row.normalizedStatus] ?? row.normalizedStatus,
        `${trDecimal.format(Number(row.amountTotal))} ${row.currencyCode}`,
      ],
      y,
      index,
    );
  });

  if (maximumRows !== null && details.length > maximumRows) {
    if (y + 30 > doc.page.height - PAGE_BOTTOM) {
      doc.addPage();
      y = drawPersonContinuationHeader(doc, fonts, pdfText, report, salesperson);
    }
    drawText(
      doc,
      fonts,
      pdfText,
      `Toplu PDF’de son ${trNumber.format(maximumRows)} teklif gösterildi. Toplam ${trNumber.format(details.length)} kayıt Excel çıktısında eksiksiz yer alır.`,
      PAGE_LEFT,
      y + 10,
      contentWidth(doc),
      7,
      false,
      MUTED_TEXT,
    );
  }
}

function drawPersonPage(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  report: MonthlyQuotationReportResult,
  salesperson: MonthlyQuotationSalespersonRow,
  details: readonly MonthlyQuotationDetailRow[],
  addPage: boolean,
  includeAllDetails: boolean,
): void {
  if (addPage) {
    doc.addPage();
  }

  let y = drawReportHeader(
    doc,
    fonts,
    pdfText,
    report,
    salesperson.displayName,
    'Personel performans raporu',
  );
  drawText(
    doc,
    fonts,
    pdfText,
    salesperson.salespersonId === null
      ? 'Kaynakta personel atanmamış'
      : `Odoo kullanıcı #${salesperson.salespersonId}`,
    PAGE_LEFT,
    y - 9,
    contentWidth(doc),
    7,
    false,
    MUTED_TEXT,
  );
  y = drawMetricCards(doc, fonts, pdfText, salespersonMetrics(salesperson), y + 7);
  y = drawTopCustomers(doc, fonts, pdfText, details, y);
  y = drawSectionTitle(doc, fonts, pdfText, 'Teklif detayı', y);
  drawDetailTable(
    doc,
    fonts,
    pdfText,
    report,
    salesperson,
    details,
    includeAllDetails ? null : 25,
    y,
  );
}

function addPageFooters(
  doc: PDFKit.PDFDocument,
  fonts: RegisteredFonts,
  pdfText: (value: string) => string,
  report: MonthlyQuotationReportResult,
): void {
  const pageRange = doc.bufferedPageRange();

  for (let index = pageRange.start; index < pageRange.start + pageRange.count; index += 1) {
    doc.switchToPage(index);
    const footerY = doc.page.height - 20;
    doc
      .moveTo(PAGE_LEFT, footerY - 7)
      .lineTo(doc.page.width - PAGE_RIGHT, footerY - 7)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke();
    drawText(
      doc,
      fonts,
      pdfText,
      `Ertip Report App · ${report.definition.code}`,
      PAGE_LEFT,
      footerY,
      360,
      6.5,
      false,
      MUTED_TEXT,
    );
    drawText(
      doc,
      fonts,
      pdfText,
      `Sayfa ${index - pageRange.start + 1} / ${pageRange.count}`,
      doc.page.width - PAGE_RIGHT - 140,
      footerY,
      140,
      6.5,
      false,
      MUTED_TEXT,
      'right',
    );
  }
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
    bufferPages: true,
    layout: 'landscape',
    margin: 0,
    size: 'A4',
    info: {
      Title: input.report.definition.name,
      Author: 'Ertip Report App',
      Subject: `${input.report.businessUnit.displayName} teklif performansı`,
    },
  });
  const output = collectPdfBuffer(doc);
  const fonts = registerFonts(doc);
  const pdfText = createPdfTextFormatter(fonts.unicode);

  if (input.scope === 'all') {
    drawOverviewPage(doc, fonts, pdfText, input.report);

    for (const salesperson of input.report.salespeople) {
      const details = input.report.details.filter(
        ({ salespersonId }) => salespersonId === salesperson.salespersonId,
      );
      drawPersonPage(
        doc,
        fonts,
        pdfText,
        input.report,
        salesperson,
        details,
        true,
        false,
      );
    }
  } else {
    const salesperson = input.report.salespeople[0];

    if (!salesperson) {
      throw new Error('SALESPERSON_REPORT_EMPTY');
    }

    const details = input.report.details.filter(
      ({ salespersonId }) => salespersonId === salesperson.salespersonId,
    );
    drawPersonPage(
      doc,
      fonts,
      pdfText,
      input.report,
      salesperson,
      details,
      false,
      true,
    );
  }

  addPageFooters(doc, fonts, pdfText, input.report);
  doc.end();
  return output;
}
