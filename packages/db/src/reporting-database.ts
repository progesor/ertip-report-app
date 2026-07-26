import type { Pool, QueryResultRow } from 'pg';

import {
  buildMonthlyQuotationReport,
  buildOpenAgingQuotationReport,
  getMonthlyQuotationReportDataWindow,
  type MonthlyQuotationBusinessUnit,
  type MonthlyQuotationReportFilters,
  type MonthlyQuotationReportResult,
  type MonthlyQuotationSourceRecord,
  type OpenAgingQuotationReportFilters,
  type OpenAgingQuotationReportResult,
  type OpenAgingQuotationSourceRecord,
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
): MonthlyQuotationSourceRecord & OpenAgingQuotationSourceRecord {
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
