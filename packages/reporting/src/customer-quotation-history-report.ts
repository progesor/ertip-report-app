import {
  calculateQuotationMetrics,
  normalizeQuotationStatus,
  type NormalizedQuotationStatus,
  type QuotationMetrics,
} from './metrics.ts';
import type {
  NumericReportFilterOption,
  ReportBusinessUnitContract,
  ReportResultContract,
} from './report-result-contract.ts';

export const CUSTOMER_QUOTATION_HISTORY_REPORT_DEFINITION = {
  code: 'customer-quotation-history',
  name: 'Müşteri Teklif Geçmişi',
  version: '1.0.0',
  metricVersion: '1.0.0',
  dateAxis: 'sale.order.create_date',
  resultMode: 'live',
} as const;

export const CUSTOMER_HISTORY_STATUS_FILTERS = [
  'all',
  'realized',
  'open',
  'not_realized',
  'expired',
  'cancelled',
  'unknown',
] as const;
export type CustomerHistoryStatusFilter = (typeof CUSTOMER_HISTORY_STATUS_FILTERS)[number];

export interface CustomerQuotationHistoryFilters {
  readonly businessUnitId: string;
  readonly customerId: number;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly salespersonId: number | null;
  readonly status: CustomerHistoryStatusFilter;
}

export interface CustomerQuotationHistoryFilterInput {
  readonly businessUnitId?: string | null;
  readonly customerId?: string | number | null;
  readonly dateFrom?: string | null;
  readonly dateTo?: string | null;
  readonly salespersonId?: string | number | null;
  readonly status?: string | null;
}

export interface CustomerQuotationHistorySourceRecord {
  readonly id: number;
  readonly state: string;
  readonly validityDate: string | null;
  readonly createDate: string;
  readonly dateOrder: string;
  readonly salespersonId: number | null;
  readonly salespersonName: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly amountTotal: string;
  readonly currencyCode: string;
}

export interface CustomerQuotationHistoryTimelineRow {
  readonly id: number;
  readonly sequenceNumber: number;
  readonly createDate: string;
  readonly dateOrder: string;
  readonly salespersonId: number | null;
  readonly salespersonName: string;
  readonly sourceState: string;
  readonly normalizedStatus: NormalizedQuotationStatus;
  readonly validityDate: string | null;
  readonly amountTotal: string;
  readonly currencyCode: string;
  readonly daysSincePreviousQuotation: number | null;
}

export interface CustomerQuotationHistorySalespersonRow {
  readonly salespersonId: number | null;
  readonly displayName: string;
  readonly metrics: QuotationMetrics;
  readonly firstQuotationDate: string;
  readonly lastQuotationDate: string;
}

export interface CustomerQuotationHistoryStatusRow {
  readonly status: NormalizedQuotationStatus;
  readonly label: string;
  readonly count: number;
  readonly share: number;
}

export interface CustomerQuotationHistoryTransitionRow {
  readonly from: NormalizedQuotationStatus;
  readonly to: NormalizedQuotationStatus;
  readonly count: number;
}

export interface CustomerQuotationHistoryMonthRow {
  readonly month: string;
  readonly metrics: QuotationMetrics;
}

export interface CustomerQuotationHistoryCurrencyRow {
  readonly currencyCode: string;
  readonly quotationCount: number;
}

export interface CustomerQuotationHistoryRepeatMetrics {
  readonly repeatQuotationCount: number;
  readonly activeMonthCount: number;
  readonly averageDaysBetweenQuotations: number | null;
  readonly medianDaysBetweenQuotations: number | null;
  readonly quotationsPerActiveMonth: number | null;
}

export interface CustomerQuotationHistoryReportResult
  extends ReportResultContract<
    typeof CUSTOMER_QUOTATION_HISTORY_REPORT_DEFINITION,
    CustomerQuotationHistoryFilters
  > {
  readonly customer: NumericReportFilterOption;
  readonly metrics: QuotationMetrics;
  readonly allTime: {
    readonly quotationCount: number;
    readonly firstQuotationDate: string | null;
    readonly lastQuotationDate: string | null;
  };
  readonly period: {
    readonly firstQuotationDate: string | null;
    readonly lastQuotationDate: string | null;
  };
  readonly repeat: CustomerQuotationHistoryRepeatMetrics;
  readonly statusDistribution: readonly CustomerQuotationHistoryStatusRow[];
  readonly salespersonHistory: readonly CustomerQuotationHistorySalespersonRow[];
  readonly transitions: readonly CustomerQuotationHistoryTransitionRow[];
  readonly monthlyFrequency: readonly CustomerQuotationHistoryMonthRow[];
  readonly currencies: readonly CustomerQuotationHistoryCurrencyRow[];
  readonly timeline: readonly CustomerQuotationHistoryTimelineRow[];
  readonly timelineTotalCount: number;
  readonly timelineLimit: number;
  readonly timelineTruncated: boolean;
  readonly options: {
    readonly businessUnits: readonly ReportBusinessUnitContract[];
    readonly salespeople: readonly NumericReportFilterOption[];
  };
}

interface CustomerQuotationHistoryBuildInput {
  readonly records: readonly CustomerQuotationHistorySourceRecord[];
  readonly filters: CustomerQuotationHistoryFilters;
  readonly businessUnit: ReportBusinessUnitContract;
  readonly businessUnits: readonly ReportBusinessUnitContract[];
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt: string;
  readonly lastSyncAt: string | null;
  readonly timelineLimit?: number;
}

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/u;
const dayMs = 86_400_000;

const statusLabels: Readonly<Record<NormalizedQuotationStatus, string>> = {
  realized: 'Gerçekleşti',
  open: 'Açık',
  expired: 'Süresi doldu',
  cancelled: 'İptal',
  unknown: 'Bilinmiyor',
};

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

function getDateOnlyInTimeZone(now: Date, timeZone = 'Europe/Istanbul'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find(({ type }) => type === 'year')?.value;
  const month = parts.find(({ type }) => type === 'month')?.value;
  const day = parts.find(({ type }) => type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('REPORT_TIME_ZONE_UNAVAILABLE');
  }

  return `${year}-${month}-${day}`;
}

function dateDifferenceInDays(dateFrom: string, dateTo: string): number {
  return Math.floor((parseDateOnly(dateTo).getTime() - parseDateOnly(dateFrom).getTime()) / dayMs);
}

function readPositiveInteger(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getDefaultCustomerHistoryPeriod(
  now: Date,
): { readonly dateFrom: string; readonly dateTo: string } {
  const today = parseDateOnly(getDateOnlyInTimeZone(now));
  const dateTo = addUtcDays(today, 1);
  const dateFrom = addUtcDays(dateTo, -730);
  return { dateFrom: formatDateOnly(dateFrom), dateTo: formatDateOnly(dateTo) };
}

export function normalizeCustomerQuotationHistoryFilters(input: {
  readonly request: CustomerQuotationHistoryFilterInput;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly now: Date;
}): CustomerQuotationHistoryFilters {
  if (input.allowedBusinessUnitIds.length === 0) {
    throw new Error('REPORT_SCOPE_EMPTY');
  }

  const requestedBusinessUnitId = input.request.businessUnitId?.trim();
  if (requestedBusinessUnitId && !input.allowedBusinessUnitIds.includes(requestedBusinessUnitId)) {
    throw new Error('REPORT_SCOPE_DENIED');
  }

  const businessUnitId = requestedBusinessUnitId ?? input.allowedBusinessUnitIds[0];
  if (!businessUnitId) {
    throw new Error('REPORT_SCOPE_EMPTY');
  }

  const customerId = readPositiveInteger(input.request.customerId);
  if (customerId === null) {
    throw new Error('CUSTOMER_REQUIRED');
  }

  const defaults = getDefaultCustomerHistoryPeriod(input.now);
  const dateFrom = input.request.dateFrom?.trim() || defaults.dateFrom;
  const dateTo = input.request.dateTo?.trim() || defaults.dateTo;
  const rangeDays = dateDifferenceInDays(dateFrom, dateTo);
  if (rangeDays < 1 || rangeDays > 3_660) {
    throw new Error('INVALID_REPORT_RANGE');
  }

  const status = CUSTOMER_HISTORY_STATUS_FILTERS.includes(
    input.request.status as CustomerHistoryStatusFilter,
  )
    ? (input.request.status as CustomerHistoryStatusFilter)
    : 'all';

  return {
    businessUnitId,
    customerId,
    dateFrom,
    dateTo,
    salespersonId: readPositiveInteger(input.request.salespersonId),
    status,
  };
}

function statusMatchesFilter(
  normalizedStatus: NormalizedQuotationStatus,
  filter: CustomerHistoryStatusFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'not_realized') {
    return normalizedStatus === 'expired' || normalizedStatus === 'cancelled';
  }
  return normalizedStatus === filter;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const middleValue = sorted[middle];
  if (middleValue === undefined) return null;
  if (sorted.length % 2 === 1) return middleValue;
  const previous = sorted[middle - 1];
  return previous === undefined ? middleValue : (previous + middleValue) / 2;
}

function chronologicalSort(
  left: CustomerQuotationHistorySourceRecord,
  right: CustomerQuotationHistorySourceRecord,
): number {
  return left.createDate.localeCompare(right.createDate) || left.id - right.id;
}

function createStatusDistribution(
  rows: readonly CustomerQuotationHistoryTimelineRow[],
): readonly CustomerQuotationHistoryStatusRow[] {
  const statuses: readonly NormalizedQuotationStatus[] = [
    'realized',
    'open',
    'expired',
    'cancelled',
    'unknown',
  ];

  return statuses.map((status) => {
    const count = rows.filter((row) => row.normalizedStatus === status).length;
    return {
      status,
      label: statusLabels[status],
      count,
      share: rows.length === 0 ? 0 : count / rows.length,
    };
  });
}

function createTransitions(
  rows: readonly CustomerQuotationHistoryTimelineRow[],
): readonly CustomerQuotationHistoryTransitionRow[] {
  const counts = new Map<string, CustomerQuotationHistoryTransitionRow>();
  const chronological = [...rows].sort(
    (left, right) => left.createDate.localeCompare(right.createDate) || left.id - right.id,
  );

  for (let index = 1; index < chronological.length; index += 1) {
    const previous = chronological[index - 1];
    const current = chronological[index];
    if (!previous || !current) continue;
    const key = `${previous.normalizedStatus}:${current.normalizedStatus}`;
    const existing = counts.get(key);
    counts.set(key, {
      from: previous.normalizedStatus,
      to: current.normalizedStatus,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...counts.values()].sort(
    (left, right) =>
      right.count - left.count ||
      left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to),
  );
}

function createMonthlyFrequency(
  rows: readonly CustomerQuotationHistoryTimelineRow[],
  asOfDate: Date,
): readonly CustomerQuotationHistoryMonthRow[] {
  const groups = new Map<string, CustomerQuotationHistoryTimelineRow[]>();
  for (const row of rows) {
    const month = row.createDate.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), row]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, monthRows]) => ({
      month,
      metrics: calculateQuotationMetrics(
        monthRows.map((row) => ({
          id: row.id,
          state: row.sourceState,
          validityDate: row.validityDate,
        })),
        asOfDate,
      ),
    }));
}

export function buildCustomerQuotationHistoryReport(
  input: CustomerQuotationHistoryBuildInput,
): CustomerQuotationHistoryReportResult {
  const generatedAt = new Date(input.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    throw new Error('INVALID_REPORT_GENERATED_AT');
  }

  if (
    input.allowedBusinessUnitIds.length === 0 ||
    !input.allowedBusinessUnitIds.includes(input.filters.businessUnitId)
  ) {
    throw new Error('REPORT_SCOPE_DENIED');
  }

  const customerRecords = input.records
    .filter(({ customerId }) => customerId === input.filters.customerId)
    .sort(chronologicalSort);
  const firstCustomerRecord = customerRecords[0];
  if (!firstCustomerRecord) {
    throw new Error('REPORT_CUSTOMER_UNAVAILABLE');
  }

  const asOfDate = getDateOnlyInTimeZone(generatedAt);
  const statusAsOf = new Date(`${asOfDate}T12:00:00.000Z`);
  const periodRecords = customerRecords.filter((record) => {
    const date = record.createDate.slice(0, 10);
    const normalizedStatus = normalizeQuotationStatus(record, statusAsOf);
    return (
      date >= input.filters.dateFrom &&
      date < input.filters.dateTo &&
      (input.filters.salespersonId === null ||
        record.salespersonId === input.filters.salespersonId) &&
      statusMatchesFilter(normalizedStatus, input.filters.status)
    );
  });

  const chronologicalTimeline = periodRecords.map((record, index) => {
    const previous = periodRecords[index - 1];
    return {
      id: record.id,
      sequenceNumber: index + 1,
      createDate: record.createDate,
      dateOrder: record.dateOrder,
      salespersonId: record.salespersonId,
      salespersonName: record.salespersonName,
      sourceState: record.state,
      normalizedStatus: normalizeQuotationStatus(record, statusAsOf),
      validityDate: record.validityDate,
      amountTotal: record.amountTotal,
      currencyCode: record.currencyCode,
      daysSincePreviousQuotation: previous
        ? dateDifferenceInDays(previous.createDate.slice(0, 10), record.createDate.slice(0, 10))
        : null,
    } satisfies CustomerQuotationHistoryTimelineRow;
  });
  const metrics = calculateQuotationMetrics(periodRecords, statusAsOf);
  const intervals = chronologicalTimeline.flatMap(({ daysSincePreviousQuotation }) =>
    daysSincePreviousQuotation === null ? [] : [daysSincePreviousQuotation],
  );
  const activeMonthCount = new Set(
    chronologicalTimeline.map(({ createDate }) => createDate.slice(0, 7)),
  ).size;
  const salespersonGroups = new Map<string, CustomerQuotationHistorySourceRecord[]>();
  for (const record of periodRecords) {
    const key = record.salespersonId === null ? 'unassigned' : String(record.salespersonId);
    salespersonGroups.set(key, [...(salespersonGroups.get(key) ?? []), record]);
  }
  const salespersonHistory = [...salespersonGroups.values()]
    .map((records) => ({
      salespersonId: records[0]?.salespersonId ?? null,
      displayName: records[0]?.salespersonName ?? 'Atanmamış',
      metrics: calculateQuotationMetrics(records, statusAsOf),
      firstQuotationDate: records[0]?.createDate ?? '',
      lastQuotationDate: records.at(-1)?.createDate ?? '',
    }))
    .sort(
      (left, right) =>
        right.lastQuotationDate.localeCompare(left.lastQuotationDate) ||
        left.displayName.localeCompare(right.displayName, 'tr'),
    );
  const salespersonOptions = new Map<number, string>();
  for (const record of customerRecords) {
    if (record.salespersonId !== null) {
      salespersonOptions.set(record.salespersonId, record.salespersonName);
    }
  }
  const currencyCounts = new Map<string, number>();
  for (const row of chronologicalTimeline) {
    currencyCounts.set(row.currencyCode, (currencyCounts.get(row.currencyCode) ?? 0) + 1);
  }
  const timelineLimit = Math.min(Math.max(input.timelineLimit ?? 500, 25), 10_000);
  const newestFirst = [...chronologicalTimeline].sort(
    (left, right) => right.createDate.localeCompare(left.createDate) || right.id - left.id,
  );

  return {
    definition: CUSTOMER_QUOTATION_HISTORY_REPORT_DEFINITION,
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: input.lastSyncAt,
    asOfDate,
    businessUnit: input.businessUnit,
    filters: input.filters,
    scope: {
      businessUnitIds: [...input.allowedBusinessUnitIds],
      serverEnforced: true,
    },
    customer: {
      id: firstCustomerRecord.customerId,
      displayName: firstCustomerRecord.customerName,
    },
    metrics,
    allTime: {
      quotationCount: customerRecords.length,
      firstQuotationDate: customerRecords[0]?.createDate ?? null,
      lastQuotationDate: customerRecords.at(-1)?.createDate ?? null,
    },
    period: {
      firstQuotationDate: periodRecords[0]?.createDate ?? null,
      lastQuotationDate: periodRecords.at(-1)?.createDate ?? null,
    },
    repeat: {
      repeatQuotationCount: Math.max(0, chronologicalTimeline.length - 1),
      activeMonthCount,
      averageDaysBetweenQuotations:
        intervals.length === 0
          ? null
          : intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
      medianDaysBetweenQuotations: median(intervals),
      quotationsPerActiveMonth:
        activeMonthCount === 0 ? null : chronologicalTimeline.length / activeMonthCount,
    },
    statusDistribution: createStatusDistribution(chronologicalTimeline),
    salespersonHistory,
    transitions: createTransitions(chronologicalTimeline),
    monthlyFrequency: createMonthlyFrequency(chronologicalTimeline, statusAsOf),
    currencies: [...currencyCounts.entries()]
      .map(([currencyCode, quotationCount]) => ({ currencyCode, quotationCount }))
      .sort(
        (left, right) =>
          right.quotationCount - left.quotationCount ||
          left.currencyCode.localeCompare(right.currencyCode),
      ),
    timeline: newestFirst.slice(0, timelineLimit),
    timelineTotalCount: newestFirst.length,
    timelineLimit,
    timelineTruncated: newestFirst.length > timelineLimit,
    options: {
      businessUnits: input.businessUnits,
      salespeople: [...salespersonOptions.entries()]
        .map(([id, displayName]) => ({ id, displayName }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'tr')),
    },
  };
}
