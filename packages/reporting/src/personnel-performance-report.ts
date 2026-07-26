import {
  calculateCurrencyAmountMetrics,
  calculateDecimalAmountChange,
  createEmptyCurrencyAmountMetrics,
  medianDecimalAmounts,
  type CurrencyAmountMetrics,
  type DecimalAmountChange,
} from './currency-amount-metrics.ts';
import { calculateQuotationMetrics, normalizeQuotationStatus, type QuotationMetrics } from './metrics.ts';
import {
  getDefaultMonthlyReportPeriod,
  getMonthlyQuotationReportDataWindow,
  INTERNATIONAL_BUSINESS_UNIT_ID,
  REPORT_STATUS_FILTERS,
  type MetricChange,
  type MonthlyQuotationMetricChanges,
  type MonthlyQuotationSourceRecord,
  type MonthlyQuotationStatusFilter,
} from './monthly-quotation-report.ts';
import type {
  NumericReportFilterOption,
  ReportBusinessUnitContract,
  ReportResultContract,
} from './report-result-contract.ts';

export const PERSONNEL_PERFORMANCE_REPORT_DEFINITION = {
  code: 'personnel-performance',
  name: 'Personel Performansı',
  version: '1.0.0',
  metricVersion: '1.0.0',
  dateAxis: 'sale.order.create_date',
  resultMode: 'live',
} as const;

export interface PersonnelPerformanceFilters {
  readonly businessUnitId: string;
  readonly salespersonId: number;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly customerId: number | null;
  readonly status: MonthlyQuotationStatusFilter;
}

export interface PersonnelPerformanceFilterInput {
  readonly businessUnitId?: string | null;
  readonly salespersonId?: string | number | null;
  readonly dateFrom?: string | null;
  readonly dateTo?: string | null;
  readonly customerId?: string | number | null;
  readonly status?: string | null;
}

export type PersonnelPerformanceSourceRecord = MonthlyQuotationSourceRecord;

export interface PersonnelPerformanceTeamMedian {
  readonly quotationCount: number;
  readonly realizedCount: number;
  readonly openCount: number;
  readonly notRealizedCount: number;
  readonly quotedCustomerCount: number;
  readonly conversionRate: number | null;
}

export interface PersonnelPerformanceTeamComparison {
  readonly activeMemberCount: number;
  readonly median: PersonnelPerformanceTeamMedian;
  readonly quotationRank: number;
  readonly realizedRank: number;
  readonly conversionRank: number;
}

export interface PersonnelPerformanceCurrencyComparison {
  readonly currencyCode: string;
  readonly current: CurrencyAmountMetrics;
  readonly previous: CurrencyAmountMetrics;
  readonly teamMedian: CurrencyAmountMetrics;
  readonly changes: {
    readonly quotationAmount: DecimalAmountChange;
    readonly realizedAmount: DecimalAmountChange;
    readonly openAmount: DecimalAmountChange;
    readonly notRealizedAmount: DecimalAmountChange;
  };
}

export interface PersonnelPerformanceTrendPoint {
  readonly month: string;
  readonly metrics: QuotationMetrics;
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface PersonnelPerformanceCustomerRow {
  readonly customerId: number;
  readonly displayName: string;
  readonly metrics: QuotationMetrics;
  readonly quotationShare: number;
  readonly lastQuotationDate: string;
  readonly amounts: readonly CurrencyAmountMetrics[];
}

export interface PersonnelPerformanceConcentration {
  readonly customerCount: number;
  readonly topCustomerShare: number;
  readonly topThreeCustomerShare: number;
}

export interface PersonnelPerformanceTeamMemberRow {
  readonly salespersonId: number;
  readonly displayName: string;
  readonly metrics: QuotationMetrics;
  readonly customerCount: number;
  readonly lastQuotationDate: string | null;
  readonly amounts: readonly CurrencyAmountMetrics[];
  readonly selected: boolean;
}

export interface PersonnelPerformanceDetailRow {
  readonly id: number;
  readonly createDate: string;
  readonly dateOrder: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly sourceState: string;
  readonly normalizedStatus: ReturnType<typeof normalizeQuotationStatus>;
  readonly validityDate: string | null;
  readonly amountTotal: string;
  readonly currencyCode: string;
}

export interface PersonnelPerformanceReportResult
  extends ReportResultContract<
    typeof PERSONNEL_PERFORMANCE_REPORT_DEFINITION,
    PersonnelPerformanceFilters
  > {
  readonly salesperson: NumericReportFilterOption;
  readonly previousPeriod: {
    readonly dateFrom: string;
    readonly dateTo: string;
  };
  readonly metrics: QuotationMetrics;
  readonly previousMetrics: QuotationMetrics;
  readonly changes: MonthlyQuotationMetricChanges;
  readonly teamComparison: PersonnelPerformanceTeamComparison;
  readonly currencies: readonly PersonnelPerformanceCurrencyComparison[];
  readonly trend: readonly PersonnelPerformanceTrendPoint[];
  readonly concentration: PersonnelPerformanceConcentration;
  readonly customers: readonly PersonnelPerformanceCustomerRow[];
  readonly teamMembers: readonly PersonnelPerformanceTeamMemberRow[];
  readonly details: readonly PersonnelPerformanceDetailRow[];
  readonly detailTotalCount: number;
  readonly detailLimit: number;
  readonly detailsTruncated: boolean;
  readonly options: {
    readonly businessUnits: readonly ReportBusinessUnitContract[];
    readonly salespeople: readonly NumericReportFilterOption[];
    readonly customers: readonly NumericReportFilterOption[];
  };
}

export interface PersonnelPerformanceBuildInput {
  readonly records: readonly PersonnelPerformanceSourceRecord[];
  readonly filters: PersonnelPerformanceFilters;
  readonly salesperson: NumericReportFilterOption;
  readonly salespeople: readonly NumericReportFilterOption[];
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
  if (!dateOnlyPattern.test(value)) {
    throw new Error('INVALID_REPORT_DATE');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('INVALID_REPORT_DATE');
  }
  return parsed;
}

function dateDifferenceInDays(dateFrom: string, dateTo: string): number {
  return Math.round((parseDateOnly(dateTo).getTime() - parseDateOnly(dateFrom).getTime()) / dayMs);
}

function readPositiveInteger(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizePersonnelPerformanceFilters(input: {
  readonly request: PersonnelPerformanceFilterInput;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly now: Date;
}): PersonnelPerformanceFilters {
  if (input.allowedBusinessUnitIds.length === 0) {
    throw new Error('REPORT_SCOPE_EMPTY');
  }

  const requestedBusinessUnitId = input.request.businessUnitId?.trim();
  if (requestedBusinessUnitId && !input.allowedBusinessUnitIds.includes(requestedBusinessUnitId)) {
    throw new Error('REPORT_SCOPE_DENIED');
  }
  const businessUnitId =
    requestedBusinessUnitId ??
    (input.allowedBusinessUnitIds.includes(INTERNATIONAL_BUSINESS_UNIT_ID)
      ? INTERNATIONAL_BUSINESS_UNIT_ID
      : input.allowedBusinessUnitIds[0]);
  if (!businessUnitId) {
    throw new Error('REPORT_SCOPE_EMPTY');
  }

  const salespersonId = readPositiveInteger(input.request.salespersonId);
  if (salespersonId === null) {
    throw new Error('SALESPERSON_REQUIRED');
  }

  const defaults = getDefaultMonthlyReportPeriod(input.now);
  const dateFrom = input.request.dateFrom?.trim() || defaults.dateFrom;
  const dateTo = input.request.dateTo?.trim() || defaults.dateTo;
  const rangeDays = dateDifferenceInDays(dateFrom, dateTo);
  if (rangeDays < 1 || rangeDays > 366) {
    throw new Error('INVALID_REPORT_RANGE');
  }

  const status = REPORT_STATUS_FILTERS.includes(input.request.status as MonthlyQuotationStatusFilter)
    ? (input.request.status as MonthlyQuotationStatusFilter)
    : 'all';

  return {
    businessUnitId,
    salespersonId,
    dateFrom,
    dateTo,
    customerId: readPositiveInteger(input.request.customerId),
    status,
  };
}

export function getPersonnelPerformanceDataWindow(filters: PersonnelPerformanceFilters) {
  return getMonthlyQuotationReportDataWindow({
    businessUnitId: filters.businessUnitId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    salespersonId: filters.salespersonId,
    customerId: filters.customerId,
    status: filters.status,
    view: 'salesperson',
  });
}

function statusMatchesFilter(
  normalizedStatus: ReturnType<typeof normalizeQuotationStatus>,
  filter: MonthlyQuotationStatusFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'not_realized') {
    return normalizedStatus === 'expired' || normalizedStatus === 'cancelled';
  }
  return normalizedStatus === filter;
}

function recordsInRange(
  records: readonly PersonnelPerformanceSourceRecord[],
  dateFrom: string,
  dateTo: string,
): readonly PersonnelPerformanceSourceRecord[] {
  return records.filter(({ createDate }) => {
    const date = createDate.slice(0, 10);
    return date >= dateFrom && date < dateTo;
  });
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

function medianNumbers(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[middle - 1] ?? upper;
  return (lower + upper) / 2;
}

function latestCreateDate(records: readonly PersonnelPerformanceSourceRecord[]): string | null {
  return records.reduce<string | null>(
    (latest, record) => (latest === null || record.createDate > latest ? record.createDate : latest),
    null,
  );
}

function amountMap(
  records: readonly PersonnelPerformanceSourceRecord[],
  asOfDate: Date,
): ReadonlyMap<string, CurrencyAmountMetrics> {
  return new Map(
    calculateCurrencyAmountMetrics(records, asOfDate).map((metrics) => [metrics.currencyCode, metrics]),
  );
}

function createCurrencyComparisons(input: {
  readonly currentRecords: readonly PersonnelPerformanceSourceRecord[];
  readonly previousRecords: readonly PersonnelPerformanceSourceRecord[];
  readonly teamRecordGroups: readonly (readonly PersonnelPerformanceSourceRecord[])[];
  readonly asOfDate: Date;
}): readonly PersonnelPerformanceCurrencyComparison[] {
  const current = amountMap(input.currentRecords, input.asOfDate);
  const previous = amountMap(input.previousRecords, input.asOfDate);
  const teamMaps = input.teamRecordGroups.map((records) => amountMap(records, input.asOfDate));
  const currencyCodes = new Set<string>([...current.keys(), ...previous.keys()]);
  for (const teamMap of teamMaps) {
    for (const currencyCode of teamMap.keys()) currencyCodes.add(currencyCode);
  }

  return [...currencyCodes]
    .sort((left, right) => left.localeCompare(right))
    .map((currencyCode) => {
      const currentMetrics = current.get(currencyCode) ?? createEmptyCurrencyAmountMetrics(currencyCode);
      const previousMetrics = previous.get(currencyCode) ?? createEmptyCurrencyAmountMetrics(currencyCode);
      const memberMetrics = teamMaps.map(
        (teamMap) => teamMap.get(currencyCode) ?? createEmptyCurrencyAmountMetrics(currencyCode),
      );
      const teamMedian = {
        currencyCode,
        quotationAmount: medianDecimalAmounts(memberMetrics.map(({ quotationAmount }) => quotationAmount)),
        realizedAmount: medianDecimalAmounts(memberMetrics.map(({ realizedAmount }) => realizedAmount)),
        openAmount: medianDecimalAmounts(memberMetrics.map(({ openAmount }) => openAmount)),
        notRealizedAmount: medianDecimalAmounts(
          memberMetrics.map(({ notRealizedAmount }) => notRealizedAmount),
        ),
        expiredAmount: medianDecimalAmounts(memberMetrics.map(({ expiredAmount }) => expiredAmount)),
        cancelledAmount: medianDecimalAmounts(memberMetrics.map(({ cancelledAmount }) => cancelledAmount)),
        unknownAmount: medianDecimalAmounts(memberMetrics.map(({ unknownAmount }) => unknownAmount)),
        amountConversionRate: medianNumbers(
          memberMetrics.map(({ amountConversionRate }) => amountConversionRate ?? 0),
        ),
      } satisfies CurrencyAmountMetrics;

      return {
        currencyCode,
        current: currentMetrics,
        previous: previousMetrics,
        teamMedian,
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
      } satisfies PersonnelPerformanceCurrencyComparison;
    });
}

function createTrend(
  records: readonly PersonnelPerformanceSourceRecord[],
  filters: PersonnelPerformanceFilters,
  asOfDate: Date,
): readonly PersonnelPerformanceTrendPoint[] {
  const window = getPersonnelPerformanceDataWindow(filters);
  const start = parseDateOnly(window.trendDateFrom);

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
      metrics: calculateQuotationMetrics(monthRecords, asOfDate),
      amounts: calculateCurrencyAmountMetrics(monthRecords, asOfDate),
    };
  });
}

function rankBy(
  rows: readonly PersonnelPerformanceTeamMemberRow[],
  selectedSalespersonId: number,
  selector: (row: PersonnelPerformanceTeamMemberRow) => number,
): number {
  const sorted = [...rows].sort(
    (left, right) => selector(right) - selector(left) || left.displayName.localeCompare(right.displayName, 'tr'),
  );
  const index = sorted.findIndex(({ salespersonId }) => salespersonId === selectedSalespersonId);
  return index < 0 ? sorted.length + 1 : index + 1;
}

export function buildPersonnelPerformanceReport(
  input: PersonnelPerformanceBuildInput,
): PersonnelPerformanceReportResult {
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
  if (input.salesperson.id !== input.filters.salespersonId) {
    throw new Error('REPORT_SALESPERSON_MISMATCH');
  }

  const asOfDate = generatedAt.toISOString().slice(0, 10);
  const statusAsOf = new Date(`${asOfDate}T12:00:00.000Z`);
  const window = getPersonnelPerformanceDataWindow(input.filters);
  const dimensionFiltered = input.records.filter(
    (record) => input.filters.customerId === null || record.customerId === input.filters.customerId,
  );
  const statusFiltered = dimensionFiltered.filter((record) =>
    statusMatchesFilter(normalizeQuotationStatus(record, statusAsOf), input.filters.status),
  );
  const currentTeamRecords = recordsInRange(
    statusFiltered,
    input.filters.dateFrom,
    input.filters.dateTo,
  );
  const previousTeamRecords = recordsInRange(
    statusFiltered,
    window.previousDateFrom,
    window.previousDateTo,
  );
  const selectedCurrentRecords = currentTeamRecords.filter(
    ({ salespersonId }) => salespersonId === input.filters.salespersonId,
  );
  const selectedPreviousRecords = previousTeamRecords.filter(
    ({ salespersonId }) => salespersonId === input.filters.salespersonId,
  );
  const selectedTrendRecords = statusFiltered.filter(
    ({ salespersonId }) => salespersonId === input.filters.salespersonId,
  );
  const metrics = calculateQuotationMetrics(selectedCurrentRecords, statusAsOf);
  const previousMetrics = calculateQuotationMetrics(selectedPreviousRecords, statusAsOf);

  const currentTeamGroups = new Map<number, PersonnelPerformanceSourceRecord[]>();
  for (const record of currentTeamRecords) {
    if (record.salespersonId === null) continue;
    currentTeamGroups.set(record.salespersonId, [
      ...(currentTeamGroups.get(record.salespersonId) ?? []),
      record,
    ]);
  }
  if (!currentTeamGroups.has(input.filters.salespersonId)) {
    currentTeamGroups.set(input.filters.salespersonId, []);
  }
  const salespersonNames = new Map(input.salespeople.map(({ id, displayName }) => [id, displayName]));
  salespersonNames.set(input.salesperson.id, input.salesperson.displayName);

  const teamMembers = [...currentTeamGroups.entries()]
    .map(([salespersonId, records]) => ({
      salespersonId,
      displayName: salespersonNames.get(salespersonId) ?? `Odoo kullanıcı #${salespersonId}`,
      metrics: calculateQuotationMetrics(records, statusAsOf),
      customerCount: new Set(records.map(({ customerId }) => customerId)).size,
      lastQuotationDate: latestCreateDate(records),
      amounts: calculateCurrencyAmountMetrics(records, statusAsOf),
      selected: salespersonId === input.filters.salespersonId,
    }))
    .sort(
      (left, right) =>
        right.metrics.quotationCount - left.metrics.quotationCount ||
        left.displayName.localeCompare(right.displayName, 'tr'),
    );
  const teamMetrics = teamMembers.map(({ metrics: memberMetrics }) => memberMetrics);
  const teamMedian = {
    quotationCount: medianNumbers(teamMetrics.map(({ quotationCount }) => quotationCount)),
    realizedCount: medianNumbers(teamMetrics.map(({ realizedCount }) => realizedCount)),
    openCount: medianNumbers(teamMetrics.map(({ openCount }) => openCount)),
    notRealizedCount: medianNumbers(teamMetrics.map(({ notRealizedCount }) => notRealizedCount)),
    quotedCustomerCount: medianNumbers(
      teamMetrics.map(({ quotedCustomerCount }) => quotedCustomerCount),
    ),
    conversionRate: medianNumbers(teamMetrics.map(({ conversionRate }) => conversionRate ?? 0)),
  } satisfies PersonnelPerformanceTeamMedian;

  const customerGroups = new Map<number, PersonnelPerformanceSourceRecord[]>();
  for (const record of selectedCurrentRecords) {
    customerGroups.set(record.customerId, [...(customerGroups.get(record.customerId) ?? []), record]);
  }
  const customers = [...customerGroups.values()]
    .map((records) => {
      const customerMetrics = calculateQuotationMetrics(records, statusAsOf);
      return {
        customerId: records[0]?.customerId ?? 0,
        displayName: records[0]?.customerName ?? 'Erişilemeyen müşteri',
        metrics: customerMetrics,
        quotationShare:
          metrics.quotationCount === 0 ? 0 : customerMetrics.quotationCount / metrics.quotationCount,
        lastQuotationDate: latestCreateDate(records) ?? '',
        amounts: calculateCurrencyAmountMetrics(records, statusAsOf),
      } satisfies PersonnelPerformanceCustomerRow;
    })
    .sort(
      (left, right) =>
        right.metrics.quotationCount - left.metrics.quotationCount ||
        left.displayName.localeCompare(right.displayName, 'tr'),
    );
  const topCustomerShare = customers[0]?.quotationShare ?? 0;
  const topThreeCustomerShare = customers
    .slice(0, 3)
    .reduce((sum, customer) => sum + customer.quotationShare, 0);

  const detailLimit = Math.min(Math.max(input.detailLimit ?? 500, 25), 10_000);
  const sortedDetails = [...selectedCurrentRecords].sort(
    (left, right) => right.createDate.localeCompare(left.createDate) || right.id - left.id,
  );
  const details = sortedDetails.slice(0, detailLimit).map((record) => ({
    id: record.id,
    createDate: record.createDate,
    dateOrder: record.dateOrder,
    customerId: record.customerId,
    customerName: record.customerName,
    sourceState: record.state,
    normalizedStatus: normalizeQuotationStatus(record, statusAsOf),
    validityDate: record.validityDate ?? null,
    amountTotal: record.amountTotal,
    currencyCode: record.currencyCode,
  }));
  const customerOptions = new Map<number, string>();
  for (const record of input.records) {
    customerOptions.set(record.customerId, record.customerName);
  }

  return {
    definition: PERSONNEL_PERFORMANCE_REPORT_DEFINITION,
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: input.lastSyncAt,
    asOfDate,
    businessUnit: input.businessUnit,
    filters: input.filters,
    scope: {
      businessUnitIds: [...input.allowedBusinessUnitIds],
      serverEnforced: true,
    },
    salesperson: input.salesperson,
    previousPeriod: {
      dateFrom: window.previousDateFrom,
      dateTo: window.previousDateTo,
    },
    metrics,
    previousMetrics,
    changes: calculateChanges(metrics, previousMetrics),
    teamComparison: {
      activeMemberCount: teamMembers.length,
      median: teamMedian,
      quotationRank: rankBy(teamMembers, input.filters.salespersonId, ({ metrics: value }) => value.quotationCount),
      realizedRank: rankBy(teamMembers, input.filters.salespersonId, ({ metrics: value }) => value.realizedCount),
      conversionRank: rankBy(
        teamMembers,
        input.filters.salespersonId,
        ({ metrics: value }) => value.conversionRate ?? 0,
      ),
    },
    currencies: createCurrencyComparisons({
      currentRecords: selectedCurrentRecords,
      previousRecords: selectedPreviousRecords,
      teamRecordGroups: [...currentTeamGroups.values()],
      asOfDate: statusAsOf,
    }),
    trend: createTrend(selectedTrendRecords, input.filters, statusAsOf),
    concentration: {
      customerCount: customers.length,
      topCustomerShare,
      topThreeCustomerShare,
    },
    customers,
    teamMembers,
    details,
    detailTotalCount: sortedDetails.length,
    detailLimit,
    detailsTruncated: sortedDetails.length > detailLimit,
    options: {
      businessUnits: input.businessUnits,
      salespeople: input.salespeople,
      customers: [...customerOptions.entries()]
        .map(([id, displayName]) => ({ id, displayName }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'tr')),
    },
  };
}
