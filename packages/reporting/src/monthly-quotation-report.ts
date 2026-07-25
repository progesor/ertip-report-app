import {
  calculateQuotationMetrics,
  normalizeQuotationStatus,
  type NormalizedQuotationStatus,
  type QuotationMetrics,
  type QuotationRecord,
} from './metrics.ts';

export const INTERNATIONAL_BUSINESS_UNIT_ID = '11111111-1111-4111-8111-111111111111';

export const MONTHLY_QUOTATION_REPORT_DEFINITION = {
  code: 'international-monthly-quotation-performance',
  name: 'Yurt Dışı Aylık Teklif Performansı',
  version: '1.0.0',
  metricVersion: '1.0.0',
  dateAxis: 'sale.order.create_date',
  resultMode: 'live',
} as const;

export const REPORT_VIEW_MODES = ['general', 'salesperson', 'customer'] as const;
export type MonthlyQuotationReportView = (typeof REPORT_VIEW_MODES)[number];

export const REPORT_STATUS_FILTERS = [
  'all',
  'realized',
  'open',
  'not_realized',
  'expired',
  'cancelled',
  'unknown',
] as const;
export type MonthlyQuotationStatusFilter = (typeof REPORT_STATUS_FILTERS)[number];

export interface MonthlyQuotationReportFilters {
  readonly businessUnitId: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly salespersonId: number | null;
  readonly customerId: number | null;
  readonly status: MonthlyQuotationStatusFilter;
  readonly view: MonthlyQuotationReportView;
}

export interface MonthlyQuotationReportFilterInput {
  readonly businessUnitId?: string | null;
  readonly dateFrom?: string | null;
  readonly dateTo?: string | null;
  readonly salespersonId?: string | number | null;
  readonly customerId?: string | number | null;
  readonly status?: string | null;
  readonly view?: string | null;
}

export interface MonthlyQuotationSourceRecord extends QuotationRecord {
  readonly id: number;
  readonly createDate: string;
  readonly dateOrder: string;
  readonly salespersonId: number | null;
  readonly salespersonName: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly amountTotal: string;
  readonly currencyCode: string;
}

export interface MonthlyQuotationBusinessUnit {
  readonly id: string;
  readonly displayName: string;
  readonly currencyCode: string;
}

export interface MonthlyQuotationFilterOption {
  readonly id: number;
  readonly displayName: string;
}

export interface MetricChange {
  readonly absolute: number;
  readonly percent: number | null;
}

export interface MonthlyQuotationMetricChanges {
  readonly quotationCount: MetricChange;
  readonly realizedCount: MetricChange;
  readonly openCount: MetricChange;
  readonly notRealizedCount: MetricChange;
  readonly quotedCustomerCount: MetricChange;
  readonly conversionRate: MetricChange;
}

export interface MonthlyQuotationTrendPoint {
  readonly month: string;
  readonly quotationCount: number;
  readonly realizedCount: number;
  readonly openCount: number;
  readonly notRealizedCount: number;
}

export interface MonthlyQuotationSalespersonRow {
  readonly salespersonId: number | null;
  readonly displayName: string;
  readonly metrics: QuotationMetrics;
  readonly lastQuotationDate: string | null;
}

export interface MonthlyQuotationCustomerRow {
  readonly customerId: number;
  readonly displayName: string;
  readonly metrics: QuotationMetrics;
  readonly lastQuotationDate: string | null;
}

export interface MonthlyQuotationDetailRow {
  readonly id: number;
  readonly createDate: string;
  readonly dateOrder: string;
  readonly salespersonId: number | null;
  readonly salespersonName: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly sourceState: string;
  readonly normalizedStatus: NormalizedQuotationStatus;
  readonly validityDate: string | null;
  readonly amountTotal: string;
  readonly currencyCode: string;
}

export interface MonthlyQuotationReportResult {
  readonly definition: typeof MONTHLY_QUOTATION_REPORT_DEFINITION;
  readonly generatedAt: string;
  readonly lastSyncAt: string | null;
  readonly asOfDate: string;
  readonly businessUnit: MonthlyQuotationBusinessUnit;
  readonly filters: MonthlyQuotationReportFilters;
  readonly previousPeriod: {
    readonly dateFrom: string;
    readonly dateTo: string;
  };
  readonly metrics: QuotationMetrics;
  readonly previousMetrics: QuotationMetrics;
  readonly changes: MonthlyQuotationMetricChanges;
  readonly trend: readonly MonthlyQuotationTrendPoint[];
  readonly salespeople: readonly MonthlyQuotationSalespersonRow[];
  readonly customers: readonly MonthlyQuotationCustomerRow[];
  readonly details: readonly MonthlyQuotationDetailRow[];
  readonly detailTotalCount: number;
  readonly detailLimit: number;
  readonly detailsTruncated: boolean;
  readonly openWithoutValidityCount: number;
  readonly options: {
    readonly businessUnits: readonly MonthlyQuotationBusinessUnit[];
    readonly salespeople: readonly MonthlyQuotationFilterOption[];
    readonly customers: readonly MonthlyQuotationFilterOption[];
  };
}

interface ReportBuildInput {
  readonly records: readonly MonthlyQuotationSourceRecord[];
  readonly filters: MonthlyQuotationReportFilters;
  readonly businessUnit: MonthlyQuotationBusinessUnit;
  readonly businessUnits: readonly MonthlyQuotationBusinessUnit[];
  readonly generatedAt: string;
  readonly lastSyncAt: string | null;
  readonly detailLimit?: number;
}

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/u;

function parseDateOnly(value: string): Date {
  if (!dateOnlyPattern.test(value)) {
    throw new Error('INVALID_REPORT_DATE');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('INVALID_REPORT_DATE');
  }

  return parsed;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(value: Date, months: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function dateDifferenceInDays(dateFrom: string, dateTo: string): number {
  return Math.round((parseDateOnly(dateTo).getTime() - parseDateOnly(dateFrom).getTime()) / 86_400_000);
}

function readOptionalPositiveInteger(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getDatePartsInTimeZone(now: Date, timeZone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find(({ type }) => type === 'year')?.value);
  const month = Number(parts.find(({ type }) => type === 'month')?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error('REPORT_TIME_ZONE_UNAVAILABLE');
  }

  return { year, month };
}

export function getDefaultMonthlyReportPeriod(
  now: Date,
  timeZone = 'Europe/Istanbul',
): { readonly dateFrom: string; readonly dateTo: string } {
  const { year, month } = getDatePartsInTimeZone(now, timeZone);
  const dateFrom = new Date(Date.UTC(year, month - 1, 1));
  const dateTo = new Date(Date.UTC(year, month, 1));
  return { dateFrom: formatDateOnly(dateFrom), dateTo: formatDateOnly(dateTo) };
}

export function normalizeMonthlyQuotationReportFilters(input: {
  readonly request: MonthlyQuotationReportFilterInput;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly now: Date;
}): MonthlyQuotationReportFilters {
  if (input.allowedBusinessUnitIds.length === 0) {
    throw new Error('REPORT_SCOPE_EMPTY');
  }

  const defaultPeriod = getDefaultMonthlyReportPeriod(input.now);
  const dateFrom = input.request.dateFrom?.trim() || defaultPeriod.dateFrom;
  const dateTo = input.request.dateTo?.trim() || defaultPeriod.dateTo;
  const rangeDays = dateDifferenceInDays(dateFrom, dateTo);

  if (rangeDays < 1 || rangeDays > 366) {
    throw new Error('INVALID_REPORT_RANGE');
  }

  const requestedBusinessUnit = input.request.businessUnitId?.trim();
  const defaultBusinessUnit = input.allowedBusinessUnitIds.includes(INTERNATIONAL_BUSINESS_UNIT_ID)
    ? INTERNATIONAL_BUSINESS_UNIT_ID
    : input.allowedBusinessUnitIds[0];
  const businessUnitId =
    requestedBusinessUnit && input.allowedBusinessUnitIds.includes(requestedBusinessUnit)
      ? requestedBusinessUnit
      : defaultBusinessUnit;

  if (!businessUnitId) {
    throw new Error('REPORT_SCOPE_EMPTY');
  }

  const status = REPORT_STATUS_FILTERS.includes(input.request.status as MonthlyQuotationStatusFilter)
    ? (input.request.status as MonthlyQuotationStatusFilter)
    : 'all';
  const view = REPORT_VIEW_MODES.includes(input.request.view as MonthlyQuotationReportView)
    ? (input.request.view as MonthlyQuotationReportView)
    : 'general';

  return {
    businessUnitId,
    dateFrom,
    dateTo,
    salespersonId: readOptionalPositiveInteger(input.request.salespersonId),
    customerId: readOptionalPositiveInteger(input.request.customerId),
    status,
    view,
  };
}

export function getMonthlyQuotationReportDataWindow(filters: MonthlyQuotationReportFilters): {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly previousDateFrom: string;
  readonly previousDateTo: string;
  readonly trendDateFrom: string;
} {
  const durationDays = dateDifferenceInDays(filters.dateFrom, filters.dateTo);
  const dateFrom = parseDateOnly(filters.dateFrom);
  const dateTo = parseDateOnly(filters.dateTo);
  const previousDateTo = dateFrom;
  const previousDateFrom = addUtcDays(previousDateTo, -durationDays);
  const selectedLastDay = addUtcDays(dateTo, -1);
  const trendDateFrom = addUtcMonths(startOfUtcMonth(selectedLastDay), -5);
  const earliest = [previousDateFrom, trendDateFrom, dateFrom].sort(
    (left, right) => left.getTime() - right.getTime(),
  )[0];

  if (!earliest) {
    throw new Error('REPORT_WINDOW_UNAVAILABLE');
  }

  return {
    dateFrom: formatDateOnly(earliest),
    dateTo: filters.dateTo,
    previousDateFrom: formatDateOnly(previousDateFrom),
    previousDateTo: filters.dateFrom,
    trendDateFrom: formatDateOnly(trendDateFrom),
  };
}

function statusMatchesFilter(
  normalizedStatus: NormalizedQuotationStatus,
  filter: MonthlyQuotationStatusFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'not_realized') {
    return normalizedStatus === 'expired' || normalizedStatus === 'cancelled';
  }

  return normalizedStatus === filter;
}

function calculateMetricChange(current: number, previous: number): MetricChange {
  return {
    absolute: current - previous,
    percent: previous === 0 ? null : (current - previous) / previous,
  };
}

function calculateChanges(
  current: QuotationMetrics,
  previous: QuotationMetrics,
): MonthlyQuotationMetricChanges {
  return {
    quotationCount: calculateMetricChange(current.quotationCount, previous.quotationCount),
    realizedCount: calculateMetricChange(current.realizedCount, previous.realizedCount),
    openCount: calculateMetricChange(current.openCount, previous.openCount),
    notRealizedCount: calculateMetricChange(current.notRealizedCount, previous.notRealizedCount),
    quotedCustomerCount: calculateMetricChange(
      current.quotedCustomerCount,
      previous.quotedCustomerCount,
    ),
    conversionRate: calculateMetricChange(
      current.conversionRate ?? 0,
      previous.conversionRate ?? 0,
    ),
  };
}

function recordsInRange(
  records: readonly MonthlyQuotationSourceRecord[],
  dateFrom: string,
  dateTo: string,
): readonly MonthlyQuotationSourceRecord[] {
  return records.filter(({ createDate }) => {
    const date = createDate.slice(0, 10);
    return date >= dateFrom && date < dateTo;
  });
}

function latestCreateDate(records: readonly MonthlyQuotationSourceRecord[]): string | null {
  return records.reduce<string | null>((latest, record) => {
    if (latest === null || record.createDate > latest) {
      return record.createDate;
    }

    return latest;
  }, null);
}

function sortByCountAndName<T extends { readonly metrics: QuotationMetrics; readonly displayName: string }>(
  rows: readonly T[],
): readonly T[] {
  return [...rows].sort(
    (left, right) =>
      right.metrics.quotationCount - left.metrics.quotationCount ||
      left.displayName.localeCompare(right.displayName, 'tr'),
  );
}

function createTrend(
  records: readonly MonthlyQuotationSourceRecord[],
  filters: MonthlyQuotationReportFilters,
  asOfDate: Date,
): readonly MonthlyQuotationTrendPoint[] {
  const window = getMonthlyQuotationReportDataWindow(filters);
  const start = parseDateOnly(window.trendDateFrom);

  return Array.from({ length: 6 }, (_, index) => {
    const monthStart = addUtcMonths(start, index);
    const monthEnd = addUtcMonths(start, index + 1);
    const monthRecords = recordsInRange(records, formatDateOnly(monthStart), formatDateOnly(monthEnd));
    const metrics = calculateQuotationMetrics(monthRecords, asOfDate);

    return {
      month: formatDateOnly(monthStart).slice(0, 7),
      quotationCount: metrics.quotationCount,
      realizedCount: metrics.realizedCount,
      openCount: metrics.openCount,
      notRealizedCount: metrics.notRealizedCount,
    };
  });
}

export function buildMonthlyQuotationReport(input: ReportBuildInput): MonthlyQuotationReportResult {
  const generatedAt = new Date(input.generatedAt);

  if (Number.isNaN(generatedAt.getTime())) {
    throw new Error('INVALID_REPORT_GENERATED_AT');
  }

  const asOfDate = generatedAt.toISOString().slice(0, 10);
  const statusAsOf = new Date(`${asOfDate}T12:00:00.000Z`);
  const window = getMonthlyQuotationReportDataWindow(input.filters);
  const dimensionFiltered = input.records.filter(
    (record) =>
      (input.filters.salespersonId === null || record.salespersonId === input.filters.salespersonId) &&
      (input.filters.customerId === null || record.customerId === input.filters.customerId),
  );
  const statusFiltered = dimensionFiltered.filter((record) =>
    statusMatchesFilter(normalizeQuotationStatus(record, statusAsOf), input.filters.status),
  );
  const currentRecords = recordsInRange(
    statusFiltered,
    input.filters.dateFrom,
    input.filters.dateTo,
  );
  const previousRecords = recordsInRange(
    statusFiltered,
    window.previousDateFrom,
    window.previousDateTo,
  );
  const metrics = calculateQuotationMetrics(currentRecords, statusAsOf);
  const previousMetrics = calculateQuotationMetrics(previousRecords, statusAsOf);
  const salespersonGroups = new Map<string, MonthlyQuotationSourceRecord[]>();
  const customerGroups = new Map<number, MonthlyQuotationSourceRecord[]>();

  for (const record of currentRecords) {
    const salespersonKey = record.salespersonId === null ? 'unassigned' : String(record.salespersonId);
    salespersonGroups.set(salespersonKey, [
      ...(salespersonGroups.get(salespersonKey) ?? []),
      record,
    ]);
    customerGroups.set(record.customerId, [...(customerGroups.get(record.customerId) ?? []), record]);
  }

  const salespeople = sortByCountAndName(
    [...salespersonGroups.values()].map((records) => ({
      salespersonId: records[0]?.salespersonId ?? null,
      displayName: records[0]?.salespersonName ?? 'Atanmamış',
      metrics: calculateQuotationMetrics(records, statusAsOf),
      lastQuotationDate: latestCreateDate(records),
    })),
  );
  const customers = sortByCountAndName(
    [...customerGroups.values()].map((records) => ({
      customerId: records[0]?.customerId ?? 0,
      displayName: records[0]?.customerName ?? 'Erişilemeyen müşteri',
      metrics: calculateQuotationMetrics(records, statusAsOf),
      lastQuotationDate: latestCreateDate(records),
    })),
  );
  const detailLimit = Math.min(Math.max(input.detailLimit ?? 500, 25), 1_000);
  const sortedDetails = [...currentRecords].sort(
    (left, right) => right.createDate.localeCompare(left.createDate) || right.id - left.id,
  );
  const details = sortedDetails.slice(0, detailLimit).map((record) => ({
    id: record.id,
    createDate: record.createDate,
    dateOrder: record.dateOrder,
    salespersonId: record.salespersonId,
    salespersonName: record.salespersonName,
    customerId: record.customerId,
    customerName: record.customerName,
    sourceState: record.state,
    normalizedStatus: normalizeQuotationStatus(record, statusAsOf),
    validityDate: record.validityDate ?? null,
    amountTotal: record.amountTotal,
    currencyCode: record.currencyCode,
  }));
  const salespersonOptions = new Map<number, string>();
  const customerOptions = new Map<number, string>();

  for (const record of input.records) {
    if (record.salespersonId !== null) {
      salespersonOptions.set(record.salespersonId, record.salespersonName);
    }
    customerOptions.set(record.customerId, record.customerName);
  }

  return {
    definition: MONTHLY_QUOTATION_REPORT_DEFINITION,
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: input.lastSyncAt,
    asOfDate,
    businessUnit: input.businessUnit,
    filters: input.filters,
    previousPeriod: {
      dateFrom: window.previousDateFrom,
      dateTo: window.previousDateTo,
    },
    metrics,
    previousMetrics,
    changes: calculateChanges(metrics, previousMetrics),
    trend: createTrend(statusFiltered, input.filters, statusAsOf),
    salespeople,
    customers,
    details,
    detailTotalCount: sortedDetails.length,
    detailLimit,
    detailsTruncated: sortedDetails.length > detailLimit,
    openWithoutValidityCount: currentRecords.filter(
      (record) =>
        (record.state === 'draft' || record.state === 'sent') && !record.validityDate,
    ).length,
    options: {
      businessUnits: input.businessUnits,
      salespeople: [...salespersonOptions.entries()]
        .map(([id, displayName]) => ({ id, displayName }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'tr')),
      customers: [...customerOptions.entries()]
        .map(([id, displayName]) => ({ id, displayName }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'tr')),
    },
  };
}
