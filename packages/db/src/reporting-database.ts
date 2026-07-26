import type { Pool, QueryResultRow } from 'pg';

import {
  buildCustomerQuotationHistoryReport,
  buildMonthlyQuotationReport,
  buildOpenAgingQuotationReport,
  buildPersonnelPerformanceReport,
  getMonthlyQuotationReportDataWindow,
  getPersonnelPerformanceDataWindow,
  type CustomerQuotationHistoryFilters,
  type CustomerQuotationHistoryReportResult,
  type CustomerQuotationHistorySourceRecord,
  type MonthlyQuotationBusinessUnit,
  type MonthlyQuotationReportFilters,
  type MonthlyQuotationReportResult,
  type MonthlyQuotationSourceRecord,
  type OpenAgingQuotationReportFilters,
  type OpenAgingQuotationReportResult,
  type OpenAgingQuotationSourceRecord,
  type PersonnelPerformanceFilters,
  type PersonnelPerformanceReportResult,
  type PersonnelPerformanceSourceRecord,
} from '@ertip/reporting';

export interface MonthlyQuotationReportQuery {
  readonly filters: MonthlyQuotationReportFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly detailLimit?: number;
}

export interface OpenAgingQuotationReportQuery {
  readonly filters: OpenAgingQuotationReportFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly detailLimit?: number;
}

export interface CustomerQuotationHistoryReportQuery {
  readonly filters: CustomerQuotationHistoryFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly timelineLimit?: number;
}

export interface CustomerQuotationHistoryDirectoryQuery {
  readonly businessUnitId: string;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly search?: string;
  readonly limit?: number;
}

export interface CustomerQuotationHistoryDirectoryRow {
  readonly customerId: number;
  readonly displayName: string;
  readonly quotationCount: number;
  readonly salespersonCount: number;
  readonly firstQuotationDate: string;
  readonly lastQuotationDate: string;
}

export interface PersonnelPerformanceReportQuery {
  readonly filters: PersonnelPerformanceFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly detailLimit?: number;
}

export interface PersonnelPerformanceDirectoryQuery {
  readonly businessUnitId: string;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly search?: string;
  readonly limit?: number;
}

export interface PersonnelPerformanceDirectoryRow {
  readonly salespersonId: number;
  readonly displayName: string;
  readonly quotationCount: number;
  readonly realizedCount: number;
  readonly customerCount: number;
  readonly firstQuotationDate: string;
  readonly lastQuotationDate: string;
}

interface BusinessUnitRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly source_currency_code: string;
}

interface ReportSourceRow extends QueryResultRow {
  readonly odoo_id: number;
  readonly source_state: string;
  readonly validity_date: string | Date | null;
  readonly create_date: Date;
  readonly date_order: Date;
  readonly odoo_salesperson_id: number | null;
  readonly salesperson_name: string | null;
  readonly odoo_partner_id: number;
  readonly customer_name: string;
  readonly amount_total: string;
  readonly currency_code: string;
}

interface CustomerDirectoryRow extends QueryResultRow {
  readonly odoo_partner_id: number;
  readonly display_name: string;
  readonly quotation_count: string;
  readonly salesperson_count: string;
  readonly first_quotation_date: Date;
  readonly last_quotation_date: Date;
}

interface PersonnelDirectoryRow extends QueryResultRow {
  readonly odoo_salesperson_id: number;
  readonly display_name: string;
  readonly quotation_count: string;
  readonly realized_count: string;
  readonly customer_count: string;
  readonly first_quotation_date: Date;
  readonly last_quotation_date: Date;
}

interface LastSyncRow extends QueryResultRow {
  readonly completed_at: Date;
}

function toDateOnly(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function mapBusinessUnit(row: BusinessUnitRow): MonthlyQuotationBusinessUnit {
  return {
    id: row.id,
    displayName: row.display_name,
    currencyCode: row.source_currency_code,
  };
}

function mapSourceRecord(
  row: ReportSourceRow,
): MonthlyQuotationSourceRecord &
  OpenAgingQuotationSourceRecord &
  CustomerQuotationHistorySourceRecord &
  PersonnelPerformanceSourceRecord {
  return {
    id: row.odoo_id,
    state: row.source_state,
    validityDate: toDateOnly(row.validity_date),
    customerId: row.odoo_partner_id,
    customerName: row.customer_name,
    salespersonId: row.odoo_salesperson_id,
    salespersonName: row.salesperson_name ?? 'Atanmamış',
    createDate: row.create_date.toISOString(),
    dateOrder: row.date_order.toISOString(),
    amountTotal: row.amount_total,
    currencyCode: row.currency_code,
  };
}

async function queryBusinessUnits(
  pool: Pool,
  allowedBusinessUnitIds: readonly string[],
): Promise<readonly MonthlyQuotationBusinessUnit[]> {
  const result = await pool.query<BusinessUnitRow>(
    `SELECT id::text, display_name, source_currency_code
     FROM business_units
     WHERE active = true
       AND id = ANY($1::uuid[])
       AND source_currency_code IS NOT NULL
     ORDER BY display_order, code`,
    [allowedBusinessUnitIds],
  );
  return result.rows.map(mapBusinessUnit);
}

async function queryLastSuccessfulSync(pool: Pool): Promise<string | null> {
  const result = await pool.query<LastSyncRow>(
    `SELECT completed_at
     FROM sync_runs
     WHERE kind = 'sale_order'
       AND status = 'succeeded'
       AND reconciles = true
     ORDER BY completed_at DESC
     LIMIT 1`,
  );
  return result.rows[0]?.completed_at.toISOString() ?? null;
}

const reportSourceSelect = `SELECT
   orders.odoo_id,
   orders.source_state,
   orders.validity_date,
   orders.create_date,
   orders.date_order,
   orders.odoo_salesperson_id,
   salespeople.display_name AS salesperson_name,
   orders.odoo_partner_id,
   customers.display_name AS customer_name,
   orders.amount_total::text,
   COALESCE(
     NULLIF(upper(currency_meta.value), ''),
     currency_units.source_currency_code,
     'XXX'
   ) AS currency_code
 FROM odoo_sale_orders AS orders
 JOIN business_units AS units ON units.id = orders.business_unit_id
 JOIN odoo_customers AS customers ON customers.odoo_partner_id = orders.odoo_partner_id
 LEFT JOIN odoo_salespeople AS salespeople
   ON salespeople.odoo_user_id = orders.odoo_salesperson_id
 LEFT JOIN app_meta AS currency_meta
   ON currency_meta.key = 'odoo_currency_code:' || orders.odoo_currency_id::text
 LEFT JOIN LATERAL (
   SELECT candidate.source_currency_code
   FROM business_units AS candidate
   WHERE candidate.source_currency_id = orders.odoo_currency_id
     AND candidate.source_currency_code IS NOT NULL
   ORDER BY candidate.display_order, candidate.code
   LIMIT 1
 ) AS currency_units ON true`;

function assertReportScope(
  filtersBusinessUnitId: string,
  allowedBusinessUnitIds: readonly string[],
): void {
  if (
    allowedBusinessUnitIds.length === 0 ||
    !allowedBusinessUnitIds.includes(filtersBusinessUnitId)
  ) {
    throw new Error('REPORT_SCOPE_DENIED');
  }
}

export async function queryMonthlyQuotationReport(
  pool: Pool,
  input: MonthlyQuotationReportQuery,
): Promise<MonthlyQuotationReportResult> {
  assertReportScope(input.filters.businessUnitId, input.allowedBusinessUnitIds);
  const window = getMonthlyQuotationReportDataWindow(input.filters);
  const [businessUnits, sourceResult, lastSyncAt] = await Promise.all([
    queryBusinessUnits(pool, input.allowedBusinessUnitIds),
    pool.query<ReportSourceRow>(
      `${reportSourceSelect}
       WHERE orders.business_unit_id = $1::uuid
         AND orders.create_date >= $2::date
         AND orders.create_date < $3::date
       ORDER BY orders.create_date, orders.odoo_id`,
      [input.filters.businessUnitId, window.dateFrom, window.dateTo],
    ),
    queryLastSuccessfulSync(pool),
  ]);
  const businessUnit = businessUnits.find(({ id }) => id === input.filters.businessUnitId);

  if (!businessUnit) {
    throw new Error('REPORT_BUSINESS_UNIT_UNAVAILABLE');
  }

  return buildMonthlyQuotationReport({
    records: sourceResult.rows.map(mapSourceRecord),
    filters: input.filters,
    businessUnit,
    businessUnits,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    lastSyncAt,
    ...(input.detailLimit === undefined ? {} : { detailLimit: input.detailLimit }),
  });
}

export async function queryOpenAgingQuotationReport(
  pool: Pool,
  input: OpenAgingQuotationReportQuery,
): Promise<OpenAgingQuotationReportResult> {
  assertReportScope(input.filters.businessUnitId, input.allowedBusinessUnitIds);
  const [businessUnits, sourceResult, lastSyncAt] = await Promise.all([
    queryBusinessUnits(pool, input.allowedBusinessUnitIds),
    pool.query<ReportSourceRow>(
      `${reportSourceSelect}
       WHERE orders.business_unit_id = $1::uuid
         AND orders.source_state = ANY($2::text[])
       ORDER BY orders.create_date, orders.odoo_id`,
      [input.filters.businessUnitId, ['draft', 'sent']],
    ),
    queryLastSuccessfulSync(pool),
  ]);
  const businessUnit = businessUnits.find(({ id }) => id === input.filters.businessUnitId);

  if (!businessUnit) {
    throw new Error('REPORT_BUSINESS_UNIT_UNAVAILABLE');
  }

  return buildOpenAgingQuotationReport({
    records: sourceResult.rows.map(mapSourceRecord),
    filters: input.filters,
    businessUnit,
    businessUnits,
    allowedBusinessUnitIds: input.allowedBusinessUnitIds,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    lastSyncAt,
    ...(input.detailLimit === undefined ? {} : { detailLimit: input.detailLimit }),
  });
}

export async function searchCustomerQuotationHistoryDirectory(
  pool: Pool,
  input: CustomerQuotationHistoryDirectoryQuery,
): Promise<readonly CustomerQuotationHistoryDirectoryRow[]> {
  assertReportScope(input.businessUnitId, input.allowedBusinessUnitIds);
  const search = input.search?.trim() ?? '';
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
  const result = await pool.query<CustomerDirectoryRow>(
    `SELECT
       customers.odoo_partner_id,
       customers.display_name,
       count(*)::text AS quotation_count,
       count(DISTINCT orders.odoo_salesperson_id)::text AS salesperson_count,
       min(orders.create_date) AS first_quotation_date,
       max(orders.create_date) AS last_quotation_date
     FROM odoo_sale_orders AS orders
     JOIN odoo_customers AS customers ON customers.odoo_partner_id = orders.odoo_partner_id
     WHERE orders.business_unit_id = $1::uuid
       AND ($2::text = '' OR customers.display_name ILIKE '%' || $2 || '%')
     GROUP BY customers.odoo_partner_id, customers.display_name
     ORDER BY max(orders.create_date) DESC, customers.display_name
     LIMIT $3`,
    [input.businessUnitId, search, limit],
  );

  return result.rows.map((row) => ({
    customerId: row.odoo_partner_id,
    displayName: row.display_name,
    quotationCount: Number(row.quotation_count),
    salespersonCount: Number(row.salesperson_count),
    firstQuotationDate: row.first_quotation_date.toISOString(),
    lastQuotationDate: row.last_quotation_date.toISOString(),
  }));
}

export async function queryCustomerQuotationHistoryReport(
  pool: Pool,
  input: CustomerQuotationHistoryReportQuery,
): Promise<CustomerQuotationHistoryReportResult> {
  assertReportScope(input.filters.businessUnitId, input.allowedBusinessUnitIds);
  const [businessUnits, sourceResult, lastSyncAt] = await Promise.all([
    queryBusinessUnits(pool, input.allowedBusinessUnitIds),
    pool.query<ReportSourceRow>(
      `${reportSourceSelect}
       WHERE orders.business_unit_id = $1::uuid
         AND orders.odoo_partner_id = $2::integer
       ORDER BY orders.create_date, orders.odoo_id`,
      [input.filters.businessUnitId, input.filters.customerId],
    ),
    queryLastSuccessfulSync(pool),
  ]);
  const businessUnit = businessUnits.find(({ id }) => id === input.filters.businessUnitId);

  if (!businessUnit) {
    throw new Error('REPORT_BUSINESS_UNIT_UNAVAILABLE');
  }

  return buildCustomerQuotationHistoryReport({
    records: sourceResult.rows.map(mapSourceRecord),
    filters: input.filters,
    businessUnit,
    businessUnits,
    allowedBusinessUnitIds: input.allowedBusinessUnitIds,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    lastSyncAt,
    ...(input.timelineLimit === undefined ? {} : { timelineLimit: input.timelineLimit }),
  });
}

async function queryPersonnelDirectoryRows(
  pool: Pool,
  input: PersonnelPerformanceDirectoryQuery,
): Promise<readonly PersonnelPerformanceDirectoryRow[]> {
  assertReportScope(input.businessUnitId, input.allowedBusinessUnitIds);
  const search = input.search?.trim() ?? '';
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
  const result = await pool.query<PersonnelDirectoryRow>(
    `SELECT
       orders.odoo_salesperson_id,
       COALESCE(salespeople.display_name, 'Odoo kullanıcı #' || orders.odoo_salesperson_id::text) AS display_name,
       count(*)::text AS quotation_count,
       count(*) FILTER (WHERE orders.source_state = 'sale')::text AS realized_count,
       count(DISTINCT orders.odoo_partner_id)::text AS customer_count,
       min(orders.create_date) AS first_quotation_date,
       max(orders.create_date) AS last_quotation_date
     FROM odoo_sale_orders AS orders
     LEFT JOIN odoo_salespeople AS salespeople
       ON salespeople.odoo_user_id = orders.odoo_salesperson_id
     WHERE orders.business_unit_id = $1::uuid
       AND orders.odoo_salesperson_id IS NOT NULL
       AND (
         $2::text = '' OR
         COALESCE(salespeople.display_name, 'Odoo kullanıcı #' || orders.odoo_salesperson_id::text)
           ILIKE '%' || $2 || '%'
       )
     GROUP BY orders.odoo_salesperson_id, salespeople.display_name
     ORDER BY max(orders.create_date) DESC, display_name
     LIMIT $3`,
    [input.businessUnitId, search, limit],
  );

  return result.rows.map((row) => ({
    salespersonId: row.odoo_salesperson_id,
    displayName: row.display_name,
    quotationCount: Number(row.quotation_count),
    realizedCount: Number(row.realized_count),
    customerCount: Number(row.customer_count),
    firstQuotationDate: row.first_quotation_date.toISOString(),
    lastQuotationDate: row.last_quotation_date.toISOString(),
  }));
}

export async function searchPersonnelPerformanceDirectory(
  pool: Pool,
  input: PersonnelPerformanceDirectoryQuery,
): Promise<readonly PersonnelPerformanceDirectoryRow[]> {
  return queryPersonnelDirectoryRows(pool, input);
}

export async function queryPersonnelPerformanceReport(
  pool: Pool,
  input: PersonnelPerformanceReportQuery,
): Promise<PersonnelPerformanceReportResult> {
  assertReportScope(input.filters.businessUnitId, input.allowedBusinessUnitIds);
  const window = getPersonnelPerformanceDataWindow(input.filters);
  const [businessUnits, sourceResult, directoryRows, lastSyncAt] = await Promise.all([
    queryBusinessUnits(pool, input.allowedBusinessUnitIds),
    pool.query<ReportSourceRow>(
      `${reportSourceSelect}
       WHERE orders.business_unit_id = $1::uuid
         AND orders.create_date >= $2::date
         AND orders.create_date < $3::date
       ORDER BY orders.create_date, orders.odoo_id`,
      [input.filters.businessUnitId, window.dateFrom, window.dateTo],
    ),
    queryPersonnelDirectoryRows(pool, {
      businessUnitId: input.filters.businessUnitId,
      allowedBusinessUnitIds: input.allowedBusinessUnitIds,
      limit: 500,
    }),
    queryLastSuccessfulSync(pool),
  ]);
  const businessUnit = businessUnits.find(({ id }) => id === input.filters.businessUnitId);
  if (!businessUnit) {
    throw new Error('REPORT_BUSINESS_UNIT_UNAVAILABLE');
  }
  const selectedDirectoryRow = directoryRows.find(
    ({ salespersonId }) => salespersonId === input.filters.salespersonId,
  );
  if (!selectedDirectoryRow) {
    throw new Error('REPORT_SALESPERSON_UNAVAILABLE');
  }
  const salespeople = directoryRows
    .map(({ salespersonId, displayName }) => ({ id: salespersonId, displayName }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'tr'));

  return buildPersonnelPerformanceReport({
    records: sourceResult.rows.map(mapSourceRecord),
    filters: input.filters,
    salesperson: {
      id: selectedDirectoryRow.salespersonId,
      displayName: selectedDirectoryRow.displayName,
    },
    salespeople,
    businessUnit,
    businessUnits,
    allowedBusinessUnitIds: input.allowedBusinessUnitIds,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    lastSyncAt,
    ...(input.detailLimit === undefined ? {} : { detailLimit: input.detailLimit }),
  });
}
