import {
  calculateCurrencyAmountMetrics,
  calculateDecimalAmountChange,
  createEmptyCurrencyAmountMetrics,
  type CurrencyAmountMetrics,
  type DecimalAmountChange,
} from './currency-amount-metrics.ts';
import type {
  CustomerQuotationHistoryCurrencyRow,
  CustomerQuotationHistoryMonthRow,
  CustomerQuotationHistoryReportResult,
  CustomerQuotationHistorySalespersonRow,
  CustomerQuotationHistorySourceRecord,
  CustomerHistoryStatusFilter,
} from './customer-quotation-history-report.ts';
import { normalizeQuotationStatus, type NormalizedQuotationStatus } from './metrics.ts';
import type {
  MonthlyQuotationCustomerRow,
  MonthlyQuotationReportResult,
  MonthlyQuotationSalespersonRow,
  MonthlyQuotationSourceRecord,
  MonthlyQuotationStatusFilter,
  MonthlyQuotationTrendPoint,
} from './monthly-quotation-report.ts';
import {
  getOpenAgingBucket,
  getOpenAgingValidityGroup,
  type OpenAgingBucket,
  type OpenAgingCustomerRow,
  type OpenAgingDistributionRow,
  type OpenAgingQuotationReportResult,
  type OpenAgingQuotationSourceRecord,
  type OpenAgingSalespersonRow,
  type OpenAgingValidityGroup,
} from './open-aging-quotation-report.ts';

export interface SourceCurrencyAmountChanges {
  readonly quotationAmount: DecimalAmountChange;
  readonly realizedAmount: DecimalAmountChange;
  readonly openAmount: DecimalAmountChange;
  readonly notRealizedAmount: DecimalAmountChange;
}

export interface SourceCurrencyPeriodComparison {
  readonly currencyCode: string;
  readonly current: CurrencyAmountMetrics;
  readonly previous: CurrencyAmountMetrics;
  readonly changes: SourceCurrencyAmountChanges;
}

export interface MonthlyQuotationTrendPointWithAmounts extends MonthlyQuotationTrendPoint {
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface MonthlyQuotationSalespersonRowWithAmounts extends MonthlyQuotationSalespersonRow {
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface MonthlyQuotationCustomerRowWithAmounts extends MonthlyQuotationCustomerRow {
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface MonthlyQuotationReportWithAmounts
  extends Omit<MonthlyQuotationReportResult, 'trend' | 'salespeople' | 'customers'> {
  readonly amounts: readonly SourceCurrencyPeriodComparison[];
  readonly trend: readonly MonthlyQuotationTrendPointWithAmounts[];
  readonly salespeople: readonly MonthlyQuotationSalespersonRowWithAmounts[];
  readonly customers: readonly MonthlyQuotationCustomerRowWithAmounts[];
}

export interface CustomerQuotationHistorySalespersonRowWithAmounts
  extends CustomerQuotationHistorySalespersonRow {
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface CustomerQuotationHistoryMonthRowWithAmounts
  extends CustomerQuotationHistoryMonthRow {
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface CustomerQuotationHistoryCurrencyRowWithAmounts
  extends CustomerQuotationHistoryCurrencyRow {
  readonly metrics: CurrencyAmountMetrics;
}

export interface CustomerQuotationHistoryReportWithAmounts
  extends Omit<
    CustomerQuotationHistoryReportResult,
    'salespersonHistory' | 'monthlyFrequency' | 'currencies'
  > {
  readonly amounts: readonly CurrencyAmountMetrics[];
  readonly salespersonHistory: readonly CustomerQuotationHistorySalespersonRowWithAmounts[];
  readonly monthlyFrequency: readonly CustomerQuotationHistoryMonthRowWithAmounts[];
  readonly currencies: readonly CustomerQuotationHistoryCurrencyRowWithAmounts[];
}

export interface OpenAgingDistributionRowWithAmounts<TCode extends string>
  extends OpenAgingDistributionRow<TCode> {
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface OpenAgingSalespersonRowWithAmounts extends OpenAgingSalespersonRow {
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface OpenAgingCustomerRowWithAmounts extends OpenAgingCustomerRow {
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface OpenAgingQuotationReportWithAmounts
  extends Omit<
    OpenAgingQuotationReportResult,
    'ageDistribution' | 'validityDistribution' | 'salespeople' | 'customers'
  > {
  readonly amounts: readonly CurrencyAmountMetrics[];
  readonly ageDistribution: readonly OpenAgingDistributionRowWithAmounts<OpenAgingBucket>[];
  readonly validityDistribution: readonly OpenAgingDistributionRowWithAmounts<OpenAgingValidityGroup>[];
  readonly salespeople: readonly OpenAgingSalespersonRowWithAmounts[];
  readonly customers: readonly OpenAgingCustomerRowWithAmounts[];
}

function recordsInRange<T extends { readonly createDate: string }>(
  records: readonly T[],
  dateFrom: string,
  dateTo: string,
): readonly T[] {
  return records.filter(({ createDate }) => {
    const date = createDate.slice(0, 10);
    return date >= dateFrom && date < dateTo;
  });
}

function statusMatches(
  normalizedStatus: NormalizedQuotationStatus,
  filter: MonthlyQuotationStatusFilter | CustomerHistoryStatusFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'not_realized') {
    return normalizedStatus === 'expired' || normalizedStatus === 'cancelled';
  }
  return normalizedStatus === filter;
}

function metricsByCurrency(
  records: readonly {
    readonly id: number;
    readonly state: string;
    readonly validityDate?: string | null;
    readonly amountTotal: string;
    readonly currencyCode: string;
  }[],
  asOfDate: Date,
): ReadonlyMap<string, CurrencyAmountMetrics> {
  return new Map(
    calculateCurrencyAmountMetrics(records, asOfDate).map((metrics) => [
      metrics.currencyCode,
      metrics,
    ]),
  );
}

function createPeriodComparisons(
  currentRecords: readonly MonthlyQuotationSourceRecord[],
  previousRecords: readonly MonthlyQuotationSourceRecord[],
  asOfDate: Date,
): readonly SourceCurrencyPeriodComparison[] {
  const current = metricsByCurrency(currentRecords, asOfDate);
  const previous = metricsByCurrency(previousRecords, asOfDate);
  const currencyCodes = new Set([...current.keys(), ...previous.keys()]);

  return [...currencyCodes]
    .sort((left, right) => left.localeCompare(right))
    .map((currencyCode) => {
      const currentMetrics = current.get(currencyCode) ?? createEmptyCurrencyAmountMetrics(currencyCode);
      const previousMetrics =
        previous.get(currencyCode) ?? createEmptyCurrencyAmountMetrics(currencyCode);
      return {
        currencyCode,
        current: currentMetrics,
        previous: previousMetrics,
        changes: {
          quotationAmount: calculateDecimalAmountChange(
            currentMetrics.quotationAmount,
            previousMetrics.quotationAmount,
          ),
          realizedAmount: calculateDecimalAmountChange(
            currentMetrics.realizedAmount,
            previousMetrics.realizedAmount,
          ),
          openAmount: calculateDecimalAmountChange(
            currentMetrics.openAmount,
            previousMetrics.openAmount,
          ),
          notRealizedAmount: calculateDecimalAmountChange(
            currentMetrics.notRealizedAmount,
            previousMetrics.notRealizedAmount,
          ),
        },
      } satisfies SourceCurrencyPeriodComparison;
    });
}

export function extendMonthlyQuotationReportWithSourceCurrencyAmounts(input: {
  readonly report: MonthlyQuotationReportResult;
  readonly records: readonly MonthlyQuotationSourceRecord[];
}): MonthlyQuotationReportWithAmounts {
  const statusAsOf = new Date(`${input.report.asOfDate}T12:00:00.000Z`);
  const dimensionFiltered = input.records.filter(
    (record) =>
      (input.report.filters.salespersonId === null ||
        record.salespersonId === input.report.filters.salespersonId) &&
      (input.report.filters.customerId === null ||
        record.customerId === input.report.filters.customerId),
  );
  const statusFiltered = dimensionFiltered.filter((record) =>
    statusMatches(
      normalizeQuotationStatus(record, statusAsOf),
      input.report.filters.status,
    ),
  );
  const currentRecords = recordsInRange(
    statusFiltered,
    input.report.filters.dateFrom,
    input.report.filters.dateTo,
  );
  const previousRecords = recordsInRange(
    statusFiltered,
    input.report.previousPeriod.dateFrom,
    input.report.previousPeriod.dateTo,
  );

  return {
    ...input.report,
    amounts: createPeriodComparisons(currentRecords, previousRecords, statusAsOf),
    trend: input.report.trend.map((point) => ({
      ...point,
      amounts: calculateCurrencyAmountMetrics(
        statusFiltered.filter(({ createDate }) => createDate.slice(0, 7) === point.month),
        statusAsOf,
      ),
    })),
    salespeople: input.report.salespeople.map((row) => ({
      ...row,
      amounts: calculateCurrencyAmountMetrics(
        currentRecords.filter(({ salespersonId }) => salespersonId === row.salespersonId),
        statusAsOf,
      ),
    })),
    customers: input.report.customers.map((row) => ({
      ...row,
      amounts: calculateCurrencyAmountMetrics(
        currentRecords.filter(({ customerId }) => customerId === row.customerId),
        statusAsOf,
      ),
    })),
  };
}

export function extendCustomerQuotationHistoryReportWithSourceCurrencyAmounts(input: {
  readonly report: CustomerQuotationHistoryReportResult;
  readonly records: readonly CustomerQuotationHistorySourceRecord[];
}): CustomerQuotationHistoryReportWithAmounts {
  const statusAsOf = new Date(`${input.report.asOfDate}T12:00:00.000Z`);
  const periodRecords = input.records.filter((record) => {
    const date = record.createDate.slice(0, 10);
    return (
      record.customerId === input.report.filters.customerId &&
      date >= input.report.filters.dateFrom &&
      date < input.report.filters.dateTo &&
      (input.report.filters.salespersonId === null ||
        record.salespersonId === input.report.filters.salespersonId) &&
      statusMatches(
        normalizeQuotationStatus(record, statusAsOf),
        input.report.filters.status,
      )
    );
  });
  const amountMap = metricsByCurrency(periodRecords, statusAsOf);

  return {
    ...input.report,
    amounts: calculateCurrencyAmountMetrics(periodRecords, statusAsOf),
    salespersonHistory: input.report.salespersonHistory.map((row) => ({
      ...row,
      amounts: calculateCurrencyAmountMetrics(
        periodRecords.filter(({ salespersonId }) => salespersonId === row.salespersonId),
        statusAsOf,
      ),
    })),
    monthlyFrequency: input.report.monthlyFrequency.map((row) => ({
      ...row,
      amounts: calculateCurrencyAmountMetrics(
        periodRecords.filter(({ createDate }) => createDate.slice(0, 7) === row.month),
        statusAsOf,
      ),
    })),
    currencies: input.report.currencies.map((row) => ({
      ...row,
      metrics:
        amountMap.get(row.currencyCode) ?? createEmptyCurrencyAmountMetrics(row.currencyCode),
    })),
  };
}

interface ClassifiedOpenAgingRecord {
  readonly record: OpenAgingQuotationSourceRecord;
  readonly ageDays: number;
  readonly ageBucket: OpenAgingBucket;
  readonly validityGroup: OpenAgingValidityGroup;
}

function dateDifferenceInDays(dateFrom: string, dateTo: string): number {
  return Math.floor(
    (new Date(`${dateTo}T00:00:00.000Z`).getTime() -
      new Date(`${dateFrom}T00:00:00.000Z`).getTime()) /
      86_400_000,
  );
}

function amountMetricsFromClassified(
  rows: readonly ClassifiedOpenAgingRecord[],
  asOfDate: Date,
): readonly CurrencyAmountMetrics[] {
  return calculateCurrencyAmountMetrics(
    rows.map(({ record }) => record),
    asOfDate,
  );
}

export function extendOpenAgingQuotationReportWithSourceCurrencyAmounts(input: {
  readonly report: OpenAgingQuotationReportResult;
  readonly records: readonly OpenAgingQuotationSourceRecord[];
}): OpenAgingQuotationReportWithAmounts {
  const statusAsOf = new Date(`${input.report.asOfDate}T12:00:00.000Z`);
  const classified = input.records
    .filter(({ state }) => state === 'draft' || state === 'sent')
    .filter(
      (record) =>
        (input.report.filters.salespersonId === null ||
          record.salespersonId === input.report.filters.salespersonId) &&
        (input.report.filters.customerId === null ||
          record.customerId === input.report.filters.customerId),
    )
    .map((record) => {
      const ageDays = Math.max(
        0,
        dateDifferenceInDays(record.createDate.slice(0, 10), input.report.asOfDate),
      );
      return {
        record,
        ageDays,
        ageBucket: getOpenAgingBucket(ageDays),
        validityGroup: getOpenAgingValidityGroup(
          record.validityDate,
          input.report.asOfDate,
        ).group,
      } satisfies ClassifiedOpenAgingRecord;
    });
  const filtered = classified.filter(
    ({ ageBucket, validityGroup }) =>
      (input.report.filters.ageBucket === 'all' ||
        ageBucket === input.report.filters.ageBucket) &&
      (input.report.filters.validityGroup === 'all' ||
        validityGroup === input.report.filters.validityGroup),
  );

  return {
    ...input.report,
    amounts: amountMetricsFromClassified(filtered, statusAsOf),
    ageDistribution: input.report.ageDistribution.map((row) => ({
      ...row,
      amounts: amountMetricsFromClassified(
        filtered.filter(({ ageBucket }) => ageBucket === row.code),
        statusAsOf,
      ),
    })),
    validityDistribution: input.report.validityDistribution.map((row) => ({
      ...row,
      amounts: amountMetricsFromClassified(
        filtered.filter(({ validityGroup }) => validityGroup === row.code),
        statusAsOf,
      ),
    })),
    salespeople: input.report.salespeople.map((row) => ({
      ...row,
      amounts: amountMetricsFromClassified(
        filtered.filter(
          ({ record }) => record.salespersonId === row.salespersonId,
        ),
        statusAsOf,
      ),
    })),
    customers: input.report.customers.map((row) => ({
      ...row,
      amounts: amountMetricsFromClassified(
        filtered.filter(({ record }) => record.customerId === row.customerId),
        statusAsOf,
      ),
    })),
  };
}
