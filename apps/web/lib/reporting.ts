import { readRuntimeConfig } from '@ertip/config';
import {
  createDatabasePool,
  queryCustomerQuotationHistoryReport,
  queryMonthlyQuotationReport,
  queryOpenAgingQuotationReport,
  queryPersonnelPerformanceReport,
  searchCustomerQuotationHistoryDirectory,
  searchPersonnelPerformanceDirectory,
  type CustomerQuotationHistoryDirectoryRow,
  type PersonnelPerformanceDirectoryRow,
} from '@ertip/db';
import {
  normalizeQuotationStatus,
  type CustomerQuotationHistoryFilters,
  type CustomerQuotationHistoryReportResult,
  type MonthlyQuotationDetailRow,
  type MonthlyQuotationReportFilters,
  type MonthlyQuotationReportResult,
  type MonthlyQuotationStatusFilter,
  type OpenAgingQuotationReportFilters,
  type OpenAgingQuotationReportResult,
  type PersonnelPerformanceFilters,
  type PersonnelPerformanceReportResult,
} from '@ertip/reporting';
import type { QueryResultRow } from 'pg';

import { getAppDatabase } from './database';

type ReportingPool = ReturnType<typeof createDatabasePool>;

interface ReportingGlobalState {
  pool?: ReportingPool;
  connectionString?: string;
}

interface ExportDetailRow extends QueryResultRow {
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

const globalState = globalThis as typeof globalThis & {
  __ertipReportingState?: ReportingGlobalState;
};

function getGlobalState(): ReportingGlobalState {
  globalState.__ertipReportingState ??= {};
  return globalState.__ertipReportingState;
}

export function getReportingPool(): ReportingPool {
  const runtime = readRuntimeConfig();
  const connectionString = runtime.database.connectionString;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const state = getGlobalState();

  if (!state.pool || state.connectionString !== connectionString) {
    state.pool = createDatabasePool({
      connectionString,
      ssl: runtime.database.ssl,
      maxConnections: 4,
    });
    state.connectionString = connectionString;
  }

  return state.pool;
}

function toDateOnly(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function statusMatchesFilter(
  normalizedStatus: MonthlyQuotationDetailRow['normalizedStatus'],
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

export async function getMonthlyQuotationReport(input: {
  readonly filters: MonthlyQuotationReportFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly detailLimit?: number;
}): Promise<MonthlyQuotationReportResult> {
  await getAppDatabase();
  return queryMonthlyQuotationReport(getReportingPool(), input);
}

export async function getOpenAgingQuotationReport(input: {
  readonly filters: OpenAgingQuotationReportFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly detailLimit?: number;
}): Promise<OpenAgingQuotationReportResult> {
  await getAppDatabase();
  return queryOpenAgingQuotationReport(getReportingPool(), input);
}

export async function getCustomerQuotationHistoryReport(input: {
  readonly filters: CustomerQuotationHistoryFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly timelineLimit?: number;
}): Promise<CustomerQuotationHistoryReportResult> {
  await getAppDatabase();
  return queryCustomerQuotationHistoryReport(getReportingPool(), input);
}

export async function getCustomerQuotationHistoryDirectory(input: {
  readonly businessUnitId: string;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly search?: string;
  readonly limit?: number;
}): Promise<readonly CustomerQuotationHistoryDirectoryRow[]> {
  await getAppDatabase();
  return searchCustomerQuotationHistoryDirectory(getReportingPool(), input);
}

export async function getPersonnelPerformanceReport(input: {
  readonly filters: PersonnelPerformanceFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly detailLimit?: number;
}): Promise<PersonnelPerformanceReportResult> {
  await getAppDatabase();
  return queryPersonnelPerformanceReport(getReportingPool(), input);
}

export async function getPersonnelPerformanceDirectory(input: {
  readonly businessUnitId: string;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly search?: string;
  readonly limit?: number;
}): Promise<readonly PersonnelPerformanceDirectoryRow[]> {
  await getAppDatabase();
  return searchPersonnelPerformanceDirectory(getReportingPool(), input);
}

export async function getMonthlyQuotationExportDetails(input: {
  readonly filters: MonthlyQuotationReportFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt: Date;
}): Promise<readonly MonthlyQuotationDetailRow[]> {
  if (
    input.allowedBusinessUnitIds.length === 0 ||
    !input.allowedBusinessUnitIds.includes(input.filters.businessUnitId)
  ) {
    throw new Error('REPORT_SCOPE_DENIED');
  }

  await getAppDatabase();
  const result = await getReportingPool().query<ExportDetailRow>(
    `SELECT
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
     ) AS currency_units ON true
     WHERE orders.business_unit_id = $1::uuid
       AND orders.create_date >= $2::date
       AND orders.create_date < $3::date
       AND ($4::integer IS NULL OR orders.odoo_salesperson_id = $4)
       AND ($5::integer IS NULL OR orders.odoo_partner_id = $5)
     ORDER BY orders.create_date DESC, orders.odoo_id DESC`,
    [
      input.filters.businessUnitId,
      input.filters.dateFrom,
      input.filters.dateTo,
      input.filters.salespersonId,
      input.filters.customerId,
    ],
  );
  const asOfDate = input.generatedAt.toISOString().slice(0, 10);
  const statusAsOf = new Date(`${asOfDate}T12:00:00.000Z`);

  return result.rows.flatMap((row) => {
    const normalizedStatus = normalizeQuotationStatus(
      {
        state: row.source_state,
        validityDate: toDateOnly(row.validity_date),
      },
      statusAsOf,
    );

    if (!statusMatchesFilter(normalizedStatus, input.filters.status)) {
      return [];
    }

    return [
      {
        id: row.odoo_id,
        createDate: row.create_date.toISOString(),
        dateOrder: row.date_order.toISOString(),
        salespersonId: row.odoo_salesperson_id,
        salespersonName: row.salesperson_name ?? 'Atanmamış',
        customerId: row.odoo_partner_id,
        customerName: row.customer_name,
        sourceState: row.source_state,
        normalizedStatus,
        validityDate: toDateOnly(row.validity_date),
        amountTotal: row.amount_total,
        currencyCode: row.currency_code,
      },
    ];
  });
}
