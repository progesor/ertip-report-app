import type {
  NumericReportFilterOption,
  ReportBusinessUnitContract,
  ReportResultContract,
} from './report-result-contract.ts';

export const OPEN_AGING_QUOTATION_REPORT_DEFINITION = {
  code: 'open-aging-quotations',
  name: 'Açık ve Yaşlanan Teklifler',
  version: '1.0.0',
  metricVersion: '1.0.0',
  dateAxis: 'sale.order.create_date',
  resultMode: 'live',
} as const;

export const OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID =
  '11111111-1111-4111-8111-111111111111';
export const NEARING_EXPIRY_DAYS = 7;

export const OPEN_AGING_BUCKETS = [
  'all',
  '0_7',
  '8_14',
  '15_30',
  '31_60',
  '61_90',
  '90_plus',
] as const;
export type OpenAgingBucketFilter = (typeof OPEN_AGING_BUCKETS)[number];
export type OpenAgingBucket = Exclude<OpenAgingBucketFilter, 'all'>;

export const OPEN_AGING_VALIDITY_GROUPS = [
  'all',
  'valid',
  'nearing_expiry',
  'overdue',
  'missing',
] as const;
export type OpenAgingValidityFilter = (typeof OPEN_AGING_VALIDITY_GROUPS)[number];
export type OpenAgingValidityGroup = Exclude<OpenAgingValidityFilter, 'all'>;

export interface OpenAgingQuotationReportFilters {
  readonly businessUnitId: string;
  readonly salespersonId: number | null;
  readonly customerId: number | null;
  readonly ageBucket: OpenAgingBucketFilter;
  readonly validityGroup: OpenAgingValidityFilter;
}

export interface OpenAgingQuotationReportFilterInput {
  readonly businessUnitId?: string | null;
  readonly salespersonId?: string | number | null;
  readonly customerId?: string | number | null;
  readonly ageBucket?: string | null;
  readonly validityGroup?: string | null;
}

export interface OpenAgingQuotationSourceRecord {
  readonly id: number;
  readonly state: string;
  readonly validityDate: string | null;
  readonly createDate: string;
  readonly salespersonId: number | null;
  readonly salespersonName: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly amountTotal: string;
  readonly currencyCode: string;
}

export interface OpenAgingQuotationMetrics {
  readonly trackedCount: number;
  readonly currentlyOpenCount: number;
  readonly overdueCount: number;
  readonly nearingExpiryCount: number;
  readonly missingValidityCount: number;
  readonly customerCount: number;
  readonly salespersonCount: number;
  readonly oldestAgeDays: number;
}

export interface OpenAgingDistributionRow<TCode extends string> {
  readonly code: TCode;
  readonly label: string;
  readonly count: number;
  readonly currentlyOpenCount: number;
  readonly overdueCount: number;
}

export interface OpenAgingOwnershipMetrics {
  readonly trackedCount: number;
  readonly currentlyOpenCount: number;
  readonly overdueCount: number;
  readonly nearingExpiryCount: number;
  readonly missingValidityCount: number;
  readonly oldestAgeDays: number;
}

export interface OpenAgingSalespersonRow {
  readonly salespersonId: number | null;
  readonly displayName: string;
  readonly metrics: OpenAgingOwnershipMetrics;
  readonly customerCount: number;
  readonly lastQuotationDate: string | null;
}

export interface OpenAgingCustomerRow {
  readonly customerId: number;
  readonly displayName: string;
  readonly metrics: OpenAgingOwnershipMetrics;
  readonly salespersonCount: number;
  readonly lastQuotationDate: string | null;
}

export interface OpenAgingQuotationDetailRow {
  readonly id: number;
  readonly createDate: string;
  readonly ageDays: number;
  readonly salespersonId: number | null;
  readonly salespersonName: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly sourceState: string;
  readonly validityDate: string | null;
  readonly validityGroup: OpenAgingValidityGroup;
  readonly currentlyOpen: boolean;
  readonly daysToExpiry: number | null;
  readonly amountTotal: string;
  readonly currencyCode: string;
}

export interface OpenAgingQuotationReportResult
  extends ReportResultContract<
    typeof OPEN_AGING_QUOTATION_REPORT_DEFINITION,
    OpenAgingQuotationReportFilters
  > {
  readonly metrics: OpenAgingQuotationMetrics;
  readonly ageDistribution: readonly OpenAgingDistributionRow<OpenAgingBucket>[];
  readonly validityDistribution: readonly OpenAgingDistributionRow<OpenAgingValidityGroup>[];
  readonly salespeople: readonly OpenAgingSalespersonRow[];
  readonly customers: readonly OpenAgingCustomerRow[];
  readonly details: readonly OpenAgingQuotationDetailRow[];
  readonly detailTotalCount: number;
  readonly detailLimit: number;
  readonly detailsTruncated: boolean;
  readonly options: {
    readonly businessUnits: readonly ReportBusinessUnitContract[];
    readonly salespeople: readonly NumericReportFilterOption[];
    readonly customers: readonly NumericReportFilterOption[];
  };
}

interface OpenAgingReportBuildInput {
  readonly records: readonly OpenAgingQuotationSourceRecord[];
  readonly filters: OpenAgingQuotationReportFilters;
  readonly businessUnit: ReportBusinessUnitContract;
  readonly businessUnits: readonly ReportBusinessUnitContract[];
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt: string;
  readonly lastSyncAt: string | null;
  readonly detailLimit?: number;
}

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/u;
const dayMs = 86_400_000;

const ageBucketLabels: Readonly<Record<OpenAgingBucket, string>> = {
  '0_7': '0–7 gün',
  '8_14': '8–14 gün',
  '15_30': '15–30 gün',
  '31_60': '31–60 gün',
  '61_90': '61–90 gün',
  '90_plus': '90+ gün',
};

const validityLabels: Readonly<Record<OpenAgingValidityGroup, string>> = {
  valid: 'Geçerli',
  nearing_expiry: 'Süresi yaklaşan',
  overdue: 'Süresi dolmuş',
  missing: 'Geçerlilik tarihi eksik',
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

function dateDifferenceInDays(dateFrom: string, dateTo: string): number {
  return Math.floor((parseDateOnly(dateTo).getTime() - parseDateOnly(dateFrom).getTime()) / dayMs);
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

function readOptionalPositiveInteger(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeOpenAgingQuotationReportFilters(input: {
  readonly request: OpenAgingQuotationReportFilterInput;
  readonly allowedBusinessUnitIds: readonly string[];
}): OpenAgingQuotationReportFilters {
  if (input.allowedBusinessUnitIds.length === 0) {
    throw new Error('REPORT_SCOPE_EMPTY');
  }

  const requestedBusinessUnitId = input.request.businessUnitId?.trim();

  if (
    requestedBusinessUnitId &&
    !input.allowedBusinessUnitIds.includes(requestedBusinessUnitId)
  ) {
    throw new Error('REPORT_SCOPE_DENIED');
  }

  const businessUnitId =
    requestedBusinessUnitId ??
    (input.allowedBusinessUnitIds.includes(OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID)
      ? OPEN_AGING_INTERNATIONAL_BUSINESS_UNIT_ID
      : input.allowedBusinessUnitIds[0]);

  if (!businessUnitId) {
    throw new Error('REPORT_SCOPE_EMPTY');
  }

  const ageBucket = OPEN_AGING_BUCKETS.includes(input.request.ageBucket as OpenAgingBucketFilter)
    ? (input.request.ageBucket as OpenAgingBucketFilter)
    : 'all';
  const validityGroup = OPEN_AGING_VALIDITY_GROUPS.includes(
    input.request.validityGroup as OpenAgingValidityFilter,
  )
    ? (input.request.validityGroup as OpenAgingValidityFilter)
    : 'all';

  return {
    businessUnitId,
    salespersonId: readOptionalPositiveInteger(input.request.salespersonId),
    customerId: readOptionalPositiveInteger(input.request.customerId),
    ageBucket,
    validityGroup,
  };
}

export function getOpenAgingBucket(ageDays: number): OpenAgingBucket {
  if (ageDays <= 7) return '0_7';
  if (ageDays <= 14) return '8_14';
  if (ageDays <= 30) return '15_30';
  if (ageDays <= 60) return '31_60';
  if (ageDays <= 90) return '61_90';
  return '90_plus';
}

export function getOpenAgingValidityGroup(
  validityDate: string | null,
  asOfDate: string,
): { readonly group: OpenAgingValidityGroup; readonly daysToExpiry: number | null } {
  if (!validityDate) {
    return { group: 'missing', daysToExpiry: null };
  }

  const daysToExpiry = dateDifferenceInDays(asOfDate, validityDate);

  if (daysToExpiry < 0) {
    return { group: 'overdue', daysToExpiry };
  }

  if (daysToExpiry <= NEARING_EXPIRY_DAYS) {
    return { group: 'nearing_expiry', daysToExpiry };
  }

  return { group: 'valid', daysToExpiry };
}

function classifyRecord(
  record: OpenAgingQuotationSourceRecord,
  asOfDate: string,
): OpenAgingQuotationDetailRow {
  const createDate = record.createDate.slice(0, 10);
  const ageDays = Math.max(0, dateDifferenceInDays(createDate, asOfDate));
  const validity = getOpenAgingValidityGroup(record.validityDate, asOfDate);

  return {
    id: record.id,
    createDate: record.createDate,
    ageDays,
    salespersonId: record.salespersonId,
    salespersonName: record.salespersonName,
    customerId: record.customerId,
    customerName: record.customerName,
    sourceState: record.state,
    validityDate: record.validityDate,
    validityGroup: validity.group,
    currentlyOpen: validity.group !== 'overdue',
    daysToExpiry: validity.daysToExpiry,
    amountTotal: record.amountTotal,
    currencyCode: record.currencyCode,
  };
}

function createMetrics(rows: readonly OpenAgingQuotationDetailRow[]): OpenAgingQuotationMetrics {
  return {
    trackedCount: rows.length,
    currentlyOpenCount: rows.filter(({ currentlyOpen }) => currentlyOpen).length,
    overdueCount: rows.filter(({ validityGroup }) => validityGroup === 'overdue').length,
    nearingExpiryCount: rows.filter(({ validityGroup }) => validityGroup === 'nearing_expiry').length,
    missingValidityCount: rows.filter(({ validityGroup }) => validityGroup === 'missing').length,
    customerCount: new Set(rows.map(({ customerId }) => customerId)).size,
    salespersonCount: new Set(
      rows.map(({ salespersonId }) => salespersonId ?? 'unassigned'),
    ).size,
    oldestAgeDays: rows.reduce((maximum, { ageDays }) => Math.max(maximum, ageDays), 0),
  };
}

function createOwnershipMetrics(
  rows: readonly OpenAgingQuotationDetailRow[],
): OpenAgingOwnershipMetrics {
  const metrics = createMetrics(rows);
  return {
    trackedCount: metrics.trackedCount,
    currentlyOpenCount: metrics.currentlyOpenCount,
    overdueCount: metrics.overdueCount,
    nearingExpiryCount: metrics.nearingExpiryCount,
    missingValidityCount: metrics.missingValidityCount,
    oldestAgeDays: metrics.oldestAgeDays,
  };
}

function latestCreateDate(rows: readonly OpenAgingQuotationDetailRow[]): string | null {
  return rows.reduce<string | null>(
    (latest, row) => (latest === null || row.createDate > latest ? row.createDate : latest),
    null,
  );
}

function createAgeDistribution(
  rows: readonly OpenAgingQuotationDetailRow[],
): readonly OpenAgingDistributionRow<OpenAgingBucket>[] {
  return OPEN_AGING_BUCKETS.filter(
    (code): code is OpenAgingBucket => code !== 'all',
  ).map((code) => {
    const bucketRows = rows.filter(({ ageDays }) => getOpenAgingBucket(ageDays) === code);
    return {
      code,
      label: ageBucketLabels[code],
      count: bucketRows.length,
      currentlyOpenCount: bucketRows.filter(({ currentlyOpen }) => currentlyOpen).length,
      overdueCount: bucketRows.filter(({ validityGroup }) => validityGroup === 'overdue').length,
    };
  });
}

function createValidityDistribution(
  rows: readonly OpenAgingQuotationDetailRow[],
): readonly OpenAgingDistributionRow<OpenAgingValidityGroup>[] {
  return OPEN_AGING_VALIDITY_GROUPS.filter(
    (code): code is OpenAgingValidityGroup => code !== 'all',
  ).map((code) => {
    const groupRows = rows.filter(({ validityGroup }) => validityGroup === code);
    return {
      code,
      label: validityLabels[code],
      count: groupRows.length,
      currentlyOpenCount: groupRows.filter(({ currentlyOpen }) => currentlyOpen).length,
      overdueCount: groupRows.filter(({ validityGroup }) => validityGroup === 'overdue').length,
    };
  });
}

export function buildOpenAgingQuotationReport(
  input: OpenAgingReportBuildInput,
): OpenAgingQuotationReportResult {
  const generatedAt = new Date(input.generatedAt);

  if (Number.isNaN(generatedAt.getTime())) {
    throw new Error('INVALID_REPORT_GENERATED_AT');
  }

  const asOfDate = getDateOnlyInTimeZone(generatedAt);
  const sourcePopulation = input.records.filter(
    ({ state }) => state === 'draft' || state === 'sent',
  );
  const salespersonOptions = new Map<number, string>();
  const customerOptions = new Map<number, string>();

  for (const record of sourcePopulation) {
    if (record.salespersonId !== null) {
      salespersonOptions.set(record.salespersonId, record.salespersonName);
    }
    customerOptions.set(record.customerId, record.customerName);
  }

  const classifiedRows = sourcePopulation
    .filter(
      (record) =>
        (input.filters.salespersonId === null ||
          record.salespersonId === input.filters.salespersonId) &&
        (input.filters.customerId === null || record.customerId === input.filters.customerId),
    )
    .map((record) => classifyRecord(record, asOfDate));
  const filteredRows = classifiedRows.filter(
    (row) =>
      (input.filters.ageBucket === 'all' ||
        getOpenAgingBucket(row.ageDays) === input.filters.ageBucket) &&
      (input.filters.validityGroup === 'all' ||
        row.validityGroup === input.filters.validityGroup),
  );
  const salespersonGroups = new Map<string, OpenAgingQuotationDetailRow[]>();
  const customerGroups = new Map<number, OpenAgingQuotationDetailRow[]>();

  for (const row of filteredRows) {
    const salespersonKey = row.salespersonId === null ? 'unassigned' : String(row.salespersonId);
    salespersonGroups.set(salespersonKey, [
      ...(salespersonGroups.get(salespersonKey) ?? []),
      row,
    ]);
    customerGroups.set(row.customerId, [...(customerGroups.get(row.customerId) ?? []), row]);
  }

  const salespeople = [...salespersonGroups.values()]
    .map((rows) => ({
      salespersonId: rows[0]?.salespersonId ?? null,
      displayName: rows[0]?.salespersonName ?? 'Atanmamış',
      metrics: createOwnershipMetrics(rows),
      customerCount: new Set(rows.map(({ customerId }) => customerId)).size,
      lastQuotationDate: latestCreateDate(rows),
    }))
    .sort(
      (left, right) =>
        right.metrics.overdueCount - left.metrics.overdueCount ||
        right.metrics.trackedCount - left.metrics.trackedCount ||
        left.displayName.localeCompare(right.displayName, 'tr'),
    );
  const customers = [...customerGroups.values()]
    .map((rows) => ({
      customerId: rows[0]?.customerId ?? 0,
      displayName: rows[0]?.customerName ?? 'Erişilemeyen müşteri',
      metrics: createOwnershipMetrics(rows),
      salespersonCount: new Set(
        rows.map(({ salespersonId }) => salespersonId ?? 'unassigned'),
      ).size,
      lastQuotationDate: latestCreateDate(rows),
    }))
    .sort(
      (left, right) =>
        right.metrics.overdueCount - left.metrics.overdueCount ||
        right.metrics.trackedCount - left.metrics.trackedCount ||
        left.displayName.localeCompare(right.displayName, 'tr'),
    );
  const validityPriority: Readonly<Record<OpenAgingValidityGroup, number>> = {
    overdue: 0,
    nearing_expiry: 1,
    missing: 2,
    valid: 3,
  };
  const sortedDetails = [...filteredRows].sort(
    (left, right) =>
      validityPriority[left.validityGroup] - validityPriority[right.validityGroup] ||
      right.ageDays - left.ageDays ||
      right.id - left.id,
  );
  const detailLimit = Math.min(Math.max(input.detailLimit ?? 500, 25), 10_000);

  return {
    definition: OPEN_AGING_QUOTATION_REPORT_DEFINITION,
    generatedAt: generatedAt.toISOString(),
    lastSyncAt: input.lastSyncAt,
    asOfDate,
    businessUnit: input.businessUnit,
    filters: input.filters,
    scope: {
      businessUnitIds: [...input.allowedBusinessUnitIds],
      serverEnforced: true,
    },
    metrics: createMetrics(filteredRows),
    ageDistribution: createAgeDistribution(filteredRows),
    validityDistribution: createValidityDistribution(filteredRows),
    salespeople,
    customers,
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
