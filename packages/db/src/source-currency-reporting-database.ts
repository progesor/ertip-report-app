import type { Pool, QueryResultRow } from 'pg';

import {
  extendCustomerQuotationHistoryReportWithSourceCurrencyAmounts,
  extendMonthlyQuotationReportWithSourceCurrencyAmounts,
  extendOpenAgingQuotationReportWithSourceCurrencyAmounts,
  getMonthlyQuotationReportDataWindow,
  type CustomerQuotationHistoryReportWithAmounts,
  type CustomerQuotationHistorySourceRecord,
  type MonthlyQuotationReportWithAmounts,
  type MonthlyQuotationSourceRecord,
  type OpenAgingQuotationReportWithAmounts,
  type OpenAgingQuotationSourceRecord,
} from '@ertip/reporting';

import {
  queryCustomerQuotationHistoryReport,
  queryMonthlyQuotationReport,
  queryOpenAgingQuotationReport,
  type CustomerQuotationHistoryReportQuery,
  type MonthlyQuotationReportQuery,
  type OpenAgingQuotationReportQuery,
} from './reporting-database.ts';

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

function toDateOnly(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function mapSourceRecord(
  row: ReportSourceRow,
): MonthlyQuotationSourceRecord &
  OpenAgingQuotationSourceRecord &
  CustomerQuotationHistorySourceRecord {
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

export async function queryMonthlyQuotationReportWithAmounts(
  pool: Pool,
  input: MonthlyQuotationReportQuery,
): Promise<MonthlyQuotationReportWithAmounts> {
  const [report, sourceResult] = await Promise.all([
    queryMonthlyQuotationReport(pool, input),
    pool.query<ReportSourceRow>(
      `${reportSourceSelect}
       WHERE orders.business_unit_id = $1::uuid
         AND orders.create_date >= $2::date
         AND orders.create_date < $3::date
       ORDER BY orders.create_date, orders.odoo_id`,
      [
        input.filters.businessUnitId,
        getMonthlyQuotationReportDataWindow(input.filters).dateFrom,
        input.filters.dateTo,
      ],
    ),
  ]);

  return extendMonthlyQuotationReportWithSourceCurrencyAmounts({
    report,
    records: sourceResult.rows.map(mapSourceRecord),
  });
}

export async function queryOpenAgingQuotationReportWithAmounts(
  pool: Pool,
  input: OpenAgingQuotationReportQuery,
): Promise<OpenAgingQuotationReportWithAmounts> {
  const [report, sourceResult] = await Promise.all([
    queryOpenAgingQuotationReport(pool, input),
    pool.query<ReportSourceRow>(
      `${reportSourceSelect}
       WHERE orders.business_unit_id = $1::uuid
         AND orders.source_state = ANY($2::text[])
       ORDER BY orders.create_date, orders.odoo_id`,
      [input.filters.businessUnitId, ['draft', 'sent']],
    ),
  ]);

  return extendOpenAgingQuotationReportWithSourceCurrencyAmounts({
    report,
    records: sourceResult.rows.map(mapSourceRecord),
  });
}

export async function queryCustomerQuotationHistoryReportWithAmounts(
  pool: Pool,
  input: CustomerQuotationHistoryReportQuery,
): Promise<CustomerQuotationHistoryReportWithAmounts> {
  const [report, sourceResult] = await Promise.all([
    queryCustomerQuotationHistoryReport(pool, input),
    pool.query<ReportSourceRow>(
      `${reportSourceSelect}
       WHERE orders.business_unit_id = $1::uuid
         AND orders.odoo_partner_id = $2::integer
       ORDER BY orders.create_date, orders.odoo_id`,
      [input.filters.businessUnitId, input.filters.customerId],
    ),
  ]);

  return extendCustomerQuotationHistoryReportWithSourceCurrencyAmounts({
    report,
    records: sourceResult.rows.map(mapSourceRecord),
  });
}
