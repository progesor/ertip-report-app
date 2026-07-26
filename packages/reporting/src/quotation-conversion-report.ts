import {
  getDefaultMonthlyReportPeriod,
  getMonthlyQuotationReportDataWindow,
  INTERNATIONAL_BUSINESS_UNIT_ID,
  type MetricChange,
  type MonthlyQuotationSourceRecord,
} from './monthly-quotation-report.ts';
import type {
  NumericReportFilterOption,
  ReportBusinessUnitContract,
  ReportResultContract,
} from './report-result-contract.ts';

export const QUOTATION_CONVERSION_REPORT_DEFINITION = {
  code: 'quotation-to-order-conversion',
  name: 'Tekliften Siparişe Dönüşüm',
  version: '1.0.0',
  metricVersion: '1.0.0',
  dateAxis: 'sale.order.create_date cohort; sale.order.date_order confirmation',
  resultMode: 'live',
} as const;

export interface QuotationConversionFilters {
  readonly businessUnitId: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly salespersonId: number | null;
  readonly customerId: number | null;
}

export interface QuotationConversionFilterInput {
  readonly businessUnitId?: string | null;
  readonly dateFrom?: string | null;
  readonly dateTo?: string | null;
  readonly salespersonId?: string | number | null;
  readonly customerId?: string | number | null;
}

export type QuotationConversionSourceRecord = MonthlyQuotationSourceRecord;

export type ConversionLagBucketCode =
  | 'same_day'
  | '1_7'
  | '8_14'
  | '15_30'
  | '31_60'
  | '61_90'
  | '90_plus'
  | 'anomaly';

export type ConversionDateRelation = 'same_month' | 'cross_month' | 'anomaly' | 'not_converted';
export type ConversionAnomalyCode = 'confirmation_before_quotation' | 'invalid_confirmation_date';

export interface QuotationConversionMetrics {
  readonly quotationCount: number;
  readonly convertedCount: number;
  readonly notConvertedCount: number;
  readonly conversionRate: number | null;
  readonly validLagConvertedCount: number;
  readonly sameMonthConvertedCount: number;
  readonly crossMonthConvertedCount: number;
  readonly sameMonthShareOfConverted: number | null;
  readonly crossMonthShareOfConverted: number | null;
  readonly averageLagDays: number | null;
  readonly medianLagDays: number | null;
  readonly p90LagDays: number | null;
  readonly anomalyCount: number;
}

export interface NullableMetricChange {
  readonly absolute: number | null;
  readonly percent: number | null;
}

export interface QuotationConversionChanges {
  readonly quotationCount: MetricChange;
  readonly convertedCount: MetricChange;
  readonly conversionRate: MetricChange;
  readonly sameMonthConvertedCount: MetricChange;
  readonly crossMonthConvertedCount: MetricChange;
  readonly averageLagDays: NullableMetricChange;
  readonly medianLagDays: NullableMetricChange;
  readonly anomalyCount: MetricChange;
}

export interface QuotationConversionLagBucket {
  readonly code: ConversionLagBucketCode;
  readonly label: string;
  readonly count: number;
  readonly shareOfConverted: number | null;
}

export interface QuotationConversionDimensionRow {
  readonly id: number | null;
  readonly displayName: string;
  readonly metrics: QuotationConversionMetrics;
}

export interface QuotationConversionTrendPoint {
  readonly month: string;
  readonly metrics: QuotationConversionMetrics;
}

export interface QuotationConversionDetailRow {
  readonly id: number;
  readonly createDate: string;
  readonly dateOrder: string;
  readonly salespersonId: number | null;
  readonly salespersonName: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly sourceState: string;
  readonly converted: boolean;
  readonly lagDays: number | null;
  readonly dateRelation: ConversionDateRelation;
  readonly lagBucket: ConversionLagBucketCode | null;
  readonly anomalyCode: ConversionAnomalyCode | null;
  readonly amountTotal: string;
  readonly currencyCode: string;
}

export interface QuotationConversionReportResult
  extends ReportResultContract<
    typeof QUOTATION_CONVERSION_REPORT_DEFINITION,
    QuotationConversionFilters
  > {
  readonly previousPeriod: {
    readonly dateFrom: string;
    readonly dateTo: string;
  };
  readonly metrics: QuotationConversionMetrics;
  readonly previousMetrics: QuotationConversionMetrics;
  readonly changes: QuotationConversionChanges;
  readonly lagDistribution: readonly QuotationConversionLagBucket[];
  readonly trend: readonly QuotationConversionTrendPoint[];
  readonly salespeople: readonly QuotationConversionDimensionRow[];
  readonly customers: readonly QuotationConversionDimensionRow[];
  readonly anomalies: {
    readonly totalCount: number;
    readonly confirmationBeforeQuotationCount: number;
    readonly invalidConfirmationDateCount: number;
  };
  readonly details: readonly QuotationConversionDetailRow[];
  readonly detailTotalCount: number;
  readonly detailLimit: number;
  readonly detailsTruncated: boolean;
  readonly options: {
    readonly businessUnits: readonly ReportBusinessUnitContract[];
    readonly salespeople: readonly NumericReportFilterOption[];
    readonly customers: readonly NumericReportFilterOption[];
  };
}

export interface QuotationConversionBuildInput {
  readonly records: readonly QuotationConversionSourceRecord[];
  readonly filters: QuotationConversionFilters;
  readonly businessUnit: ReportBusinessUnitContract;
  readonly businessUnits: readonly ReportBusinessUnitContract[];
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt: string;
  readonly lastSyncAt: string | null;
  readonly detailLimit?: number;
}

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/u;
const dayMs = 86_400_000;

function parseDateOnly(value: string): Date {
  if (!dateOnlyPattern.test(value)) throw new Error('INVALID_REPORT_DATE');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('INVALID_REPORT_DATE');
  }
  return parsed;
}

function dateDifferenceInDays(dateFrom: string, dateTo: string): number {
  return Math.round((parseDateOnly(dateTo).getTime() - parseDateOnly(dateFrom).getTime()) / dayMs);
}

function readOptionalPositiveInteger(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeQuotationConversionFilters(input: {
  readonly request: QuotationConversionFilterInput;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly now: Date;
}): QuotationConversionFilters {
  if (input.allowedBusinessUnitIds.length === 0) throw new Error('REPORT_SCOPE_EMPTY');
  const requestedBusinessUnitId = input.request.businessUnitId?.trim();
  if (requestedBusinessUnitId && !input.allowedBusinessUnitIds.includes(requestedBusinessUnitId)) {
    throw new Error('REPORT_SCOPE_DENIED');
  }
  const businessUnitId =
    requestedBusinessUnitId ??
    (input.allowedBusinessUnitIds.includes(INTERNATIONAL_BUSINESS_UNIT_ID)
      ? INTERNATIONAL_BUSINESS_UNIT_ID
      : input.allowedBusinessUnitIds[0]);
  if (!businessUnitId) throw new Error('REPORT_SCOPE_EMPTY');

  const defaults = getDefaultMonthlyReportPeriod(input.now);
  const dateFrom = input.request.dateFrom?.trim() || defaults.dateFrom;
  const dateTo = input.request.dateTo?.trim() || defaults.dateTo;
  const rangeDays = dateDifferenceInDays(dateFrom, dateTo);
  if (rangeDays < 1 || rangeDays > 366) throw new Error('INVALID_REPORT_RANGE');

  return {
    businessUnitId,
    dateFrom,
    dateTo,
    salespersonId: readOptionalPositiveInteger(input.request.salespersonId),
    customerId: readOptionalPositiveInteger(input.request.customerId),
  };
}

export function getQuotationConversionDataWindow(filters: QuotationConversionFilters) {
  return getMonthlyQuotationReportDataWindow({
    ...filters,
    status: 'all',
    view: 'general',
  });
}

function recordsInRange(
  records: readonly QuotationConversionSourceRecord[],
  dateFrom: string,
  dateTo: string,
): readonly QuotationConversionSourceRecord[] {
  return records.filter(({ createDate }) => {
    const date = createDate.slice(0, 10);
    return date >= dateFrom && date < dateTo;
  });
}

function calculateLag(record: QuotationConversionSourceRecord): {
  readonly lagDays: number | null;
  readonly dateRelation: ConversionDateRelation;
  readonly lagBucket: ConversionLagBucketCode | null;
  readonly anomalyCode: ConversionAnomalyCode | null;
} {
  if (record.state !== 'sale') {
    return { lagDays: null, dateRelation: 'not_converted', lagBucket: null, anomalyCode: null };
  }

  const createDate = record.createDate.slice(0, 10);
  const confirmationDate = record.dateOrder.slice(0, 10);
  let lagDays: number;
  try {
    lagDays = dateDifferenceInDays(createDate, confirmationDate);
  } catch {
    return {
      lagDays: null,
      dateRelation: 'anomaly',
      lagBucket: 'anomaly',
      anomalyCode: 'invalid_confirmation_date',
    };
  }

  if (lagDays < 0) {
    return {
      lagDays,
      dateRelation: 'anomaly',
      lagBucket: 'anomaly',
      anomalyCode: 'confirmation_before_quotation',
    };
  }

  const lagBucket: ConversionLagBucketCode =
    lagDays === 0
      ? 'same_day'
      : lagDays <= 7
        ? '1_7'
        : lagDays <= 14
          ? '8_14'
          : lagDays <= 30
            ? '15_30'
            : lagDays <= 60
              ? '31_60'
              : lagDays <= 90
                ? '61_90'
                : '90_plus';

  return {
    lagDays,
    dateRelation: createDate.slice(0, 7) === confirmationDate.slice(0, 7) ? 'same_month' : 'cross_month',
    lagBucket,
    anomalyCode: null,
  };
}

function percentile(sortedValues: readonly number[], percentileValue: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = Math.ceil(percentileValue * sortedValues.length) - 1;
  return sortedValues[Math.min(Math.max(index, 0), sortedValues.length - 1)] ?? null;
}

function median(sortedValues: readonly number[]): number | null {
  if (sortedValues.length === 0) return null;
  const middle = Math.floor(sortedValues.length / 2);
  const upper = sortedValues[middle] ?? 0;
  if (sortedValues.length % 2 === 1) return upper;
  const lower = sortedValues[middle - 1] ?? upper;
  return (lower + upper) / 2;
}

export function calculateQuotationConversionMetrics(
  records: readonly QuotationConversionSourceRecord[],
): QuotationConversionMetrics {
  const converted = records.filter(({ state }) => state === 'sale');
  const lagResults = converted.map(calculateLag);
  const validLagDays = lagResults
    .flatMap(({ lagDays, anomalyCode }) => (lagDays !== null && anomalyCode === null ? [lagDays] : []))
    .sort((left, right) => left - right);
  const sameMonthConvertedCount = lagResults.filter(({ dateRelation }) => dateRelation === 'same_month').length;
  const crossMonthConvertedCount = lagResults.filter(({ dateRelation }) => dateRelation === 'cross_month').length;
  const anomalyCount = lagResults.filter(({ dateRelation }) => dateRelation === 'anomaly').length;
  const convertedCount = converted.length;

  return {
    quotationCount: records.length,
    convertedCount,
    notConvertedCount: records.length - convertedCount,
    conversionRate: records.length === 0 ? null : convertedCount / records.length,
    validLagConvertedCount: validLagDays.length,
    sameMonthConvertedCount,
    crossMonthConvertedCount,
    sameMonthShareOfConverted: convertedCount === 0 ? null : sameMonthConvertedCount / convertedCount,
    crossMonthShareOfConverted: convertedCount === 0 ? null : crossMonthConvertedCount / convertedCount,
    averageLagDays:
      validLagDays.length === 0
        ? null
        : validLagDays.reduce((sum, value) => sum + value, 0) / validLagDays.length,
    medianLagDays: median(validLagDays),
    p90LagDays: percentile(validLagDays, 0.9),
    anomalyCount,
  };
}

function metricChange(current: number, previous: number): MetricChange {
  return {
    absolute: current - previous,
    percent: previous === 0 ? null : (current - previous) / previous,
  };
}

function nullableMetricChange(current: number | null, previous: number | null): NullableMetricChange {
  if (current === null || previous === null) return { absolute: null, percent: null };
  return {
    absolute: current - previous,
    percent: previous === 0 ? null : (current - previous) / previous,
  };
}

function calculateChanges(
  current: QuotationConversionMetrics,
  previous: QuotationConversionMetrics,
): QuotationConversionChanges {
  return {
    quotationCount: metricChange(current.quotationCount, previous.quotationCount),
    convertedCount: metricChange(current.convertedCount, previous.convertedCount),
    conversionRate: metricChange(current.conversionRate ?? 0, previous.conversionRate ?? 0),
    sameMonthConvertedCount: metricChange(
      current.sameMonthConvertedCount,
      previous.sameMonthConvertedCount,
    ),
    crossMonthConvertedCount: metricChange(
      current.crossMonthConvertedCount,
      previous.crossMonthConvertedCount,
    ),
    averageLagDays: nullableMetricChange(current.averageLagDays, previous.averageLagDays),
    medianLagDays: nullableMetricChange(current.medianLagDays, previous.medianLagDays),
    anomalyCount: metricChange(current.anomalyCount, previous.anomalyCount),
  };
}

const lagBucketDefinitions: readonly { readonly code: ConversionLagBucketCode; readonly label: string }[] = [
  { code: 'same_day', label: 'Aynı gün' },
  { code: '1_7', label: '1–7 gün' },
  { code: '8_14', label: '8–14 gün' },
  { code: '15_30', label: '15–30 gün' },
  { code: '31_60', label: '31–60 gün' },
  { code: '61_90', label: '61–90 gün' },
  { code: '90_plus', label: '90+ gün' },
  { code: 'anomaly', label: 'Kaynak anomalisi' },
];

function createLagDistribution(
  records: readonly QuotationConversionSourceRecord[],
): readonly QuotationConversionLagBucket[] {
  const converted = records.filter(({ state }) => state === 'sale');
  const counts = new Map<ConversionLagBucketCode, number>();
  for (const record of converted) {
    const bucket = calculateLag(record).lagBucket;
    if (bucket) counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return lagBucketDefinitions.map(({ code, label }) => {
    const count = counts.get(code) ?? 0;
    return {
      code,
      label,
      count,
      shareOfConverted: converted.length === 0 ? null : count / converted.length,
    };
  });
}

function createDimensionRows(
  records: readonly QuotationConversionSourceRecord[],
  dimension: 'salesperson' | 'customer',
): readonly QuotationConversionDimensionRow[] {
  const groups = new Map<string, QuotationConversionSourceRecord[]>();
  for (const record of records) {
    const id = dimension === 'salesperson' ? record.salespersonId : record.customerId;
    const name = dimension === 'salesperson' ? record.salespersonName : record.customerName;
    const key = `${id ?? 'null'}:${name}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.values()]
    .map((group) => {
      const first = group[0];
      return {
        id: dimension === 'salesperson' ? (first?.salespersonId ?? null) : (first?.customerId ?? null),
        displayName:
          dimension === 'salesperson'
            ? (first?.salespersonName ?? 'Atanmamış')
            : (first?.customerName ?? 'Erişilemeyen müşteri'),
        metrics: calculateQuotationConversionMetrics(group),
      };
    })
    .sort(
      (left, right) =>
        right.metrics.quotationCount - left.metrics.quotationCount ||
        left.displayName.localeCompare(right.displayName, 'tr'),
    );
}

function createTrend(
  records: readonly QuotationConversionSourceRecord[],
  filters: QuotationConversionFilters,
): readonly QuotationConversionTrendPoint[] {
  const start = parseDateOnly(getQuotationConversionDataWindow(filters).trendDateFrom);
  return Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index + 1, 1));
    const monthRecords = recordsInRange(
      records,
      monthStart.toISOString().slice(0, 10),
      monthEnd.toISOString().slice(0, 10),
    );
    return {
      month: monthStart.toISOString().slice(0, 7),
      metrics: calculateQuotationConversionMetrics(monthRecords),
    };
  });
}

function createDetail(record: QuotationConversionSourceRecord): QuotationConversionDetailRow {
  const lag = calculateLag(record);
  return {
    id: record.id,
    createDate: record.createDate,
    dateOrder: record.dateOrder,
    salespersonId: record.salespersonId,
    salespersonName: record.salespersonName,
    customerId: record.customerId,
    customerName: record.customerName,
    sourceState: record.state,
    converted: record.state === 'sale',
    lagDays: lag.lagDays,
    dateRelation: lag.dateRelation,
    lagBucket: lag.lagBucket,
    anomalyCode: lag.anomalyCode,
    amountTotal: record.amountTotal,
    currencyCode: record.currencyCode,
  };
}

export function buildQuotationConversionReport(
  input: QuotationConversionBuildInput,
): QuotationConversionReportResult {
  const generatedAt = new Date(input.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) throw new Error('INVALID_REPORT_GENERATED_AT');
  if (
    input.allowedBusinessUnitIds.length === 0 ||
    !input.allowedBusinessUnitIds.includes(input.filters.businessUnitId)
  ) {
    throw new Error('REPORT_SCOPE_DENIED');
  }

  const window = getQuotationConversionDataWindow(input.filters);
  const dimensionFiltered = input.records.filter(
    (record) =>
      (input.filters.salespersonId === null || record.salespersonId === input.filters.salespersonId) &&
      (input.filters.customerId === null || record.customerId === input.filters.customerId),
  );
  const currentRecords = recordsInRange(
    dimensionFiltered,
    input.filters.dateFrom,
    input.filters.dateTo,
  );
  const previousRecords = recordsInRange(
    dimensionFiltered,
    window.previousDateFrom,
    window.previousDateTo,
  );
  const metrics = calculateQuotationConversionMetrics(currentRecords);
  const previousMetrics = calculateQuotationConversionMetrics(previousRecords);
  const sortedDetails = [...currentRecords]
    .sort((left, right) => right.createDate.localeCompare(left.createDate) || right.id - left.id)
    .map(createDetail);
  const detailLimit = Math.min(Math.max(input.detailLimit ?? 500, 25), 10_000);
  const customerOptions = new Map<number, string>();
  const salespersonOptions = new Map<number, string>();
  for (const record of input.records) {
    customerOptions.set(record.customerId, record.customerName);
    if (record.salespersonId !== null) salespersonOptions.set(record.salespersonId, record.salespersonName);
  }
  const anomalyDetails = sortedDetails.filter(({ anomalyCode }) => anomalyCode !== null);

  return {
    definition: QUOTATION_CONVERSION_REPORT_DEFINITION,
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: input.lastSyncAt,
    asOfDate: generatedAt.toISOString().slice(0, 10),
    businessUnit: input.businessUnit,
    filters: input.filters,
    scope: {
      businessUnitIds: [...input.allowedBusinessUnitIds],
      serverEnforced: true,
    },
    previousPeriod: {
      dateFrom: window.previousDateFrom,
      dateTo: window.previousDateTo,
    },
    metrics,
    previousMetrics,
    changes: calculateChanges(metrics, previousMetrics),
    lagDistribution: createLagDistribution(currentRecords),
    trend: createTrend(dimensionFiltered, input.filters),
    salespeople: createDimensionRows(currentRecords, 'salesperson'),
    customers: createDimensionRows(currentRecords, 'customer'),
    anomalies: {
      totalCount: anomalyDetails.length,
      confirmationBeforeQuotationCount: anomalyDetails.filter(
        ({ anomalyCode }) => anomalyCode === 'confirmation_before_quotation',
      ).length,
      invalidConfirmationDateCount: anomalyDetails.filter(
        ({ anomalyCode }) => anomalyCode === 'invalid_confirmation_date',
      ).length,
    },
    details: sortedDetails.slice(0, detailLimit),
    detailTotalCount: sortedDetails.length,
    detailLimit,
    detailsTruncated: sortedDetails.length > detailLimit,
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
