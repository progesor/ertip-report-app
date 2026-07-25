import { randomUUID } from 'node:crypto';

import { type Pool, type PoolClient, type QueryResultRow } from 'pg';

import { ensureDatabaseSchema } from './schema.ts';

export const SALE_ORDER_SOURCE_STATES = ['draft', 'sent', 'sale', 'cancel'] as const;
export type SaleOrderSourceState = (typeof SALE_ORDER_SOURCE_STATES)[number];
export type SaleOrderSyncRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface BusinessUnitOdooMapping {
  readonly businessUnitId: string;
  readonly code: string;
  readonly displayName: string;
  readonly odooCompanyId: number;
  readonly sourceCurrencyId: number;
  readonly sourceCurrencyCode: string;
}

export interface SaleOrderSyncCompanyCounts {
  readonly companyId: number;
  readonly totalCount: number;
  readonly stateCounts: Readonly<Record<SaleOrderSourceState, number>>;
  readonly missingSalespersonCount: number;
}

export interface SaleOrderSyncCounts {
  readonly totalCount: number;
  readonly stateCounts: Readonly<Record<SaleOrderSourceState, number>>;
  readonly missingSalespersonCount: number;
  readonly companyCounts: readonly SaleOrderSyncCompanyCounts[];
}

export interface SaleOrderSyncRun {
  readonly id: string;
  readonly status: SaleOrderSyncRunStatus;
  readonly requestedBy: string | null;
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly cursorSourceId: number;
  readonly pageSize: number;
  readonly sourceCount: number | null;
  readonly processedCount: number;
  readonly upsertedSalespeople: number;
  readonly upsertedCustomers: number;
  readonly upsertedOrders: number;
  readonly deletedStaleOrders: number;
  readonly sourceCounts: SaleOrderSyncCounts | null;
  readonly localCounts: SaleOrderSyncCounts | null;
  readonly reconciles: boolean | null;
  readonly safeErrorCode: string | null;
  readonly errorStage: string | null;
  readonly requestedAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly updatedAt: Date;
}

export interface SaleOrderSyncSalespersonInput {
  readonly odooUserId: number;
  readonly displayName: string;
  readonly active: boolean | null;
  readonly defaultCompanyId: number | null;
  readonly writeDate: string | null;
}

export interface SaleOrderSyncCustomerInput {
  readonly odooPartnerId: number;
  readonly displayName: string;
  readonly active: boolean | null;
  readonly companyId: number | null;
  readonly commercialPartnerId: number | null;
  readonly customerRank: number | null;
  readonly writeDate: string | null;
}

export interface SaleOrderSyncOrderInput {
  readonly odooId: number;
  readonly businessUnitId: string;
  readonly odooCompanyId: number;
  readonly odooSalespersonId: number | null;
  readonly odooPartnerId: number;
  readonly odooCurrencyId: number;
  readonly sourceState: SaleOrderSourceState;
  readonly createDate: string;
  readonly dateOrder: string;
  readonly validityDate: string | null;
  readonly amountTotal: number;
  readonly writeDate: string;
}

export interface SaleOrderSyncBatch {
  readonly salespeople: readonly SaleOrderSyncSalespersonInput[];
  readonly customers: readonly SaleOrderSyncCustomerInput[];
  readonly orders: readonly SaleOrderSyncOrderInput[];
}

interface SyncRunRow extends QueryResultRow {
  readonly id: string;
  readonly status: SaleOrderSyncRunStatus;
  readonly requested_by: string | null;
  readonly date_from: string | Date | null;
  readonly date_to: string | Date | null;
  readonly cursor_source_id: number;
  readonly page_size: number;
  readonly source_count: number | null;
  readonly processed_count: number;
  readonly upserted_salespeople: number;
  readonly upserted_customers: number;
  readonly upserted_orders: number;
  readonly deleted_stale_orders: number;
  readonly source_counts_json: SaleOrderSyncCounts | null;
  readonly local_counts_json: SaleOrderSyncCounts | null;
  readonly reconciles: boolean | null;
  readonly safe_error_code: string | null;
  readonly error_stage: string | null;
  readonly requested_at: Date;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly updated_at: Date;
}

interface BusinessUnitMappingRow extends QueryResultRow {
  readonly id: string;
  readonly code: string;
  readonly display_name: string;
  readonly odoo_company_id: number;
  readonly source_currency_id: number;
  readonly source_currency_code: string;
}

interface CountRow extends QueryResultRow {
  readonly company_id: number;
  readonly source_state: SaleOrderSourceState;
  readonly count: string;
  readonly missing_salesperson_count: string;
}

function formatDateOnly(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function mapSyncRun(row: SyncRunRow): SaleOrderSyncRun {
  return {
    id: row.id,
    status: row.status,
    requestedBy: row.requested_by,
    dateFrom: formatDateOnly(row.date_from),
    dateTo: formatDateOnly(row.date_to),
    cursorSourceId: row.cursor_source_id,
    pageSize: row.page_size,
    sourceCount: row.source_count,
    processedCount: row.processed_count,
    upsertedSalespeople: row.upserted_salespeople,
    upsertedCustomers: row.upserted_customers,
    upsertedOrders: row.upserted_orders,
    deletedStaleOrders: row.deleted_stale_orders,
    sourceCounts: row.source_counts_json,
    localCounts: row.local_counts_json,
    reconciles: row.reconciles,
    safeErrorCode: row.safe_error_code,
    errorStage: row.error_stage,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function createEmptyStateCounts(): Record<SaleOrderSourceState, number> {
  return { draft: 0, sent: 0, sale: 0, cancel: 0 };
}

function normalizeCounts(value: SaleOrderSyncCounts): SaleOrderSyncCounts {
  return {
    totalCount: value.totalCount,
    stateCounts: {
      draft: value.stateCounts.draft,
      sent: value.stateCounts.sent,
      sale: value.stateCounts.sale,
      cancel: value.stateCounts.cancel,
    },
    missingSalespersonCount: value.missingSalespersonCount,
    companyCounts: [...value.companyCounts]
      .map((company) => ({
        companyId: company.companyId,
        totalCount: company.totalCount,
        stateCounts: {
          draft: company.stateCounts.draft,
          sent: company.stateCounts.sent,
          sale: company.stateCounts.sale,
          cancel: company.stateCounts.cancel,
        },
        missingSalespersonCount: company.missingSalespersonCount,
      }))
      .sort((left, right) => left.companyId - right.companyId),
  };
}

function countsReconcile(left: SaleOrderSyncCounts, right: SaleOrderSyncCounts): boolean {
  return JSON.stringify(normalizeCounts(left)) === JSON.stringify(normalizeCounts(right));
}

function scopePredicate(alias: string): string {
  return `($1::date IS NULL OR ${alias}.create_date >= $1::date)
    AND ($2::date IS NULL OR ${alias}.create_date < $2::date)`;
}

export class SyncDatabase {
  public constructor(private readonly pool: Pool) {}

  public async migrate(): Promise<void> {
    await ensureDatabaseSchema(this.pool);
  }

  public async getBusinessUnitMappings(): Promise<readonly BusinessUnitOdooMapping[]> {
    const result = await this.pool.query<BusinessUnitMappingRow>(
      `SELECT id, code, display_name, odoo_company_id, source_currency_id, source_currency_code
       FROM business_units
       WHERE active = true
         AND odoo_company_id IS NOT NULL
         AND source_currency_id IS NOT NULL
         AND source_currency_code IS NOT NULL
       ORDER BY display_order, code`,
    );

    return result.rows.map((row) => ({
      businessUnitId: row.id,
      code: row.code,
      displayName: row.display_name,
      odooCompanyId: row.odoo_company_id,
      sourceCurrencyId: row.source_currency_id,
      sourceCurrencyCode: row.source_currency_code,
    }));
  }

  public async queueSaleOrderSync(input: {
    readonly requestedBy: string;
    readonly dateFrom: string | null;
    readonly dateTo: string | null;
    readonly pageSize?: number;
  }): Promise<{ readonly run: SaleOrderSyncRun; readonly created: boolean }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [1_904_202_627]);
      const active = await client.query<SyncRunRow>(
        `SELECT * FROM sync_runs
         WHERE kind = 'sale_order' AND status IN ('queued', 'running')
         ORDER BY requested_at
         LIMIT 1`,
      );
      const existing = active.rows[0];

      if (existing !== undefined) {
        await client.query('COMMIT');
        return { run: mapSyncRun(existing), created: false };
      }

      const result = await client.query<SyncRunRow>(
        `INSERT INTO sync_runs (
           id, kind, status, requested_by, date_from, date_to, page_size
         ) VALUES ($1, 'sale_order', 'queued', $2, $3, $4, $5)
         RETURNING *`,
        [randomUUID(), input.requestedBy, input.dateFrom, input.dateTo, input.pageSize ?? 200],
      );
      await client.query('COMMIT');
      const row = result.rows[0];

      if (row === undefined) {
        throw new Error('Queued sync run was not returned.');
      }

      return { run: mapSyncRun(row), created: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async claimNextSaleOrderSync(): Promise<SaleOrderSyncRun | null> {
    const result = await this.pool.query<SyncRunRow>(
      `WITH candidate AS (
         SELECT id
         FROM sync_runs
         WHERE kind = 'sale_order' AND status = 'queued'
         ORDER BY requested_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE sync_runs
       SET status = 'running', started_at = now(), updated_at = now()
       WHERE id = (SELECT id FROM candidate)
       RETURNING *`,
    );
    const row = result.rows[0];
    return row === undefined ? null : mapSyncRun(row);
  }

  public async setSaleOrderSyncSourceCount(runId: string, sourceCount: number): Promise<void> {
    await this.pool.query(
      `UPDATE sync_runs
       SET source_count = $2, updated_at = now()
       WHERE id = $1 AND status = 'running'`,
      [runId, sourceCount],
    );
  }

  public async applySaleOrderSyncBatch(
    runId: string,
    batch: SaleOrderSyncBatch,
    cursorSourceId: number,
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await this.upsertSalespeople(client, batch.salespeople);
      await this.upsertCustomers(client, batch.customers);
      await this.upsertOrders(client, runId, batch.orders);
      await client.query(
        `UPDATE sync_runs
         SET cursor_source_id = GREATEST(cursor_source_id, $2),
             processed_count = processed_count + $3,
             upserted_salespeople = upserted_salespeople + $4,
             upserted_customers = upserted_customers + $5,
             upserted_orders = upserted_orders + $6,
             updated_at = now()
         WHERE id = $1 AND status = 'running'`,
        [
          runId,
          cursorSourceId,
          batch.orders.length,
          batch.salespeople.length,
          batch.customers.length,
          batch.orders.length,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async finalizeSaleOrderSync(
    runId: string,
    sourceCounts: SaleOrderSyncCounts,
  ): Promise<{ readonly run: SaleOrderSyncRun; readonly localCounts: SaleOrderSyncCounts }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const runResult = await client.query<SyncRunRow>(
        `SELECT * FROM sync_runs WHERE id = $1 FOR UPDATE`,
        [runId],
      );
      const runRow = runResult.rows[0];

      if (runRow === undefined || runRow.status !== 'running') {
        throw new Error('Running sync run could not be finalized.');
      }

      const staleResult = await client.query<{ readonly count: string }>(
        `WITH deleted AS (
           DELETE FROM odoo_sale_orders
           WHERE (${scopePredicate('odoo_sale_orders')})
             AND last_seen_sync_run_id IS DISTINCT FROM $3
           RETURNING 1
         )
         SELECT count(*)::text AS count FROM deleted`,
        [formatDateOnly(runRow.date_from), formatDateOnly(runRow.date_to), runId],
      );
      const deletedStaleOrders = Number(staleResult.rows[0]?.count ?? '0');
      const localCounts = await this.readLocalCounts(
        client,
        formatDateOnly(runRow.date_from),
        formatDateOnly(runRow.date_to),
      );
      const reconciles = countsReconcile(sourceCounts, localCounts);
      const status: SaleOrderSyncRunStatus = reconciles ? 'succeeded' : 'failed';
      const safeErrorCode = reconciles ? null : 'RECONCILIATION_FAILED';
      const errorStage = reconciles ? null : 'reconciliation';
      const updated = await client.query<SyncRunRow>(
        `UPDATE sync_runs
         SET status = $2,
             deleted_stale_orders = $3,
             source_counts_json = $4::jsonb,
             local_counts_json = $5::jsonb,
             reconciles = $6,
             safe_error_code = $7,
             error_stage = $8,
             completed_at = now(),
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          runId,
          status,
          deletedStaleOrders,
          JSON.stringify(normalizeCounts(sourceCounts)),
          JSON.stringify(normalizeCounts(localCounts)),
          reconciles,
          safeErrorCode,
          errorStage,
        ],
      );
      await client.query('COMMIT');
      const updatedRow = updated.rows[0];

      if (updatedRow === undefined) {
        throw new Error('Finalized sync run was not returned.');
      }

      return { run: mapSyncRun(updatedRow), localCounts };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async failSaleOrderSync(input: {
    readonly runId: string;
    readonly safeErrorCode: string;
    readonly errorStage: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE sync_runs
       SET status = 'failed',
           safe_error_code = $2,
           error_stage = $3,
           completed_at = now(),
           updated_at = now()
       WHERE id = $1 AND status IN ('queued', 'running')`,
      [input.runId, input.safeErrorCode, input.errorStage],
    );
  }

  public async getSaleOrderSyncRuns(limit = 10): Promise<readonly SaleOrderSyncRun[]> {
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 50) : 10;
    const result = await this.pool.query<SyncRunRow>(
      `SELECT * FROM sync_runs
       WHERE kind = 'sale_order'
       ORDER BY requested_at DESC
       LIMIT $1`,
      [safeLimit],
    );
    return result.rows.map(mapSyncRun);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  private async upsertSalespeople(
    client: PoolClient,
    salespeople: readonly SaleOrderSyncSalespersonInput[],
  ): Promise<void> {
    if (salespeople.length === 0) {
      return;
    }

    const records = salespeople.map((item) => ({
      odoo_user_id: item.odooUserId,
      display_name: item.displayName,
      active: item.active,
      default_company_id: item.defaultCompanyId,
      write_date: item.writeDate,
    }));
    await client.query(
      `INSERT INTO odoo_salespeople (
         odoo_user_id, display_name, active, default_company_id, write_date, synced_at
       )
       SELECT
         value.odoo_user_id,
         value.display_name,
         value.active,
         value.default_company_id,
         NULLIF(value.write_date, '')::timestamptz,
         now()
       FROM jsonb_to_recordset($1::jsonb) AS value(
         odoo_user_id integer,
         display_name text,
         active boolean,
         default_company_id integer,
         write_date text
       )
       ON CONFLICT (odoo_user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         active = EXCLUDED.active,
         default_company_id = EXCLUDED.default_company_id,
         write_date = EXCLUDED.write_date,
         synced_at = now()`,
      [JSON.stringify(records)],
    );
  }

  private async upsertCustomers(
    client: PoolClient,
    customers: readonly SaleOrderSyncCustomerInput[],
  ): Promise<void> {
    if (customers.length === 0) {
      return;
    }

    const records = customers.map((item) => ({
      odoo_partner_id: item.odooPartnerId,
      display_name: item.displayName,
      active: item.active,
      company_id: item.companyId,
      commercial_partner_id: item.commercialPartnerId,
      customer_rank: item.customerRank,
      write_date: item.writeDate,
    }));
    await client.query(
      `INSERT INTO odoo_customers (
         odoo_partner_id, display_name, active, company_id,
         commercial_partner_id, customer_rank, write_date, synced_at
       )
       SELECT
         value.odoo_partner_id,
         value.display_name,
         value.active,
         value.company_id,
         value.commercial_partner_id,
         value.customer_rank,
         NULLIF(value.write_date, '')::timestamptz,
         now()
       FROM jsonb_to_recordset($1::jsonb) AS value(
         odoo_partner_id integer,
         display_name text,
         active boolean,
         company_id integer,
         commercial_partner_id integer,
         customer_rank integer,
         write_date text
       )
       ON CONFLICT (odoo_partner_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         active = EXCLUDED.active,
         company_id = EXCLUDED.company_id,
         commercial_partner_id = EXCLUDED.commercial_partner_id,
         customer_rank = EXCLUDED.customer_rank,
         write_date = EXCLUDED.write_date,
         synced_at = now()`,
      [JSON.stringify(records)],
    );
  }

  private async upsertOrders(
    client: PoolClient,
    runId: string,
    orders: readonly SaleOrderSyncOrderInput[],
  ): Promise<void> {
    if (orders.length === 0) {
      return;
    }

    const records = orders.map((item) => ({
      odoo_id: item.odooId,
      business_unit_id: item.businessUnitId,
      odoo_company_id: item.odooCompanyId,
      odoo_salesperson_id: item.odooSalespersonId,
      odoo_partner_id: item.odooPartnerId,
      odoo_currency_id: item.odooCurrencyId,
      source_state: item.sourceState,
      create_date: item.createDate,
      date_order: item.dateOrder,
      validity_date: item.validityDate,
      amount_total: item.amountTotal,
      write_date: item.writeDate,
    }));
    await client.query(
      `INSERT INTO odoo_sale_orders (
         odoo_id, business_unit_id, odoo_company_id, odoo_salesperson_id,
         odoo_partner_id, odoo_currency_id, source_state, create_date,
         date_order, validity_date, amount_total, write_date,
         last_seen_sync_run_id, synced_at
       )
       SELECT
         value.odoo_id,
         value.business_unit_id,
         value.odoo_company_id,
         value.odoo_salesperson_id,
         value.odoo_partner_id,
         value.odoo_currency_id,
         value.source_state,
         value.create_date::timestamptz,
         value.date_order::timestamptz,
         NULLIF(value.validity_date, '')::date,
         value.amount_total,
         value.write_date::timestamptz,
         $2,
         now()
       FROM jsonb_to_recordset($1::jsonb) AS value(
         odoo_id integer,
         business_unit_id uuid,
         odoo_company_id integer,
         odoo_salesperson_id integer,
         odoo_partner_id integer,
         odoo_currency_id integer,
         source_state text,
         create_date text,
         date_order text,
         validity_date text,
         amount_total numeric,
         write_date text
       )
       ON CONFLICT (odoo_id) DO UPDATE SET
         business_unit_id = EXCLUDED.business_unit_id,
         odoo_company_id = EXCLUDED.odoo_company_id,
         odoo_salesperson_id = EXCLUDED.odoo_salesperson_id,
         odoo_partner_id = EXCLUDED.odoo_partner_id,
         odoo_currency_id = EXCLUDED.odoo_currency_id,
         source_state = EXCLUDED.source_state,
         create_date = EXCLUDED.create_date,
         date_order = EXCLUDED.date_order,
         validity_date = EXCLUDED.validity_date,
         amount_total = EXCLUDED.amount_total,
         write_date = EXCLUDED.write_date,
         last_seen_sync_run_id = EXCLUDED.last_seen_sync_run_id,
         synced_at = now()`,
      [JSON.stringify(records), runId],
    );
  }

  private async readLocalCounts(
    client: PoolClient,
    dateFrom: string | null,
    dateTo: string | null,
  ): Promise<SaleOrderSyncCounts> {
    const result = await client.query<CountRow>(
      `SELECT
         odoo_company_id AS company_id,
         source_state,
         count(*)::text AS count,
         count(*) FILTER (WHERE odoo_salesperson_id IS NULL)::text AS missing_salesperson_count
       FROM odoo_sale_orders
       WHERE ${scopePredicate('odoo_sale_orders')}
       GROUP BY odoo_company_id, source_state
       ORDER BY odoo_company_id, source_state`,
      [dateFrom, dateTo],
    );
    const companies = new Map<number, { states: Record<SaleOrderSourceState, number>; missing: number }>();
    const globalStates = createEmptyStateCounts();
    let totalCount = 0;
    let missingSalespersonCount = 0;

    for (const row of result.rows) {
      const count = Number(row.count);
      const missing = Number(row.missing_salesperson_count);
      const company = companies.get(row.company_id) ?? {
        states: createEmptyStateCounts(),
        missing: 0,
      };
      company.states[row.source_state] += count;
      company.missing += missing;
      companies.set(row.company_id, company);
      globalStates[row.source_state] += count;
      totalCount += count;
      missingSalespersonCount += missing;
    }

    return {
      totalCount,
      stateCounts: globalStates,
      missingSalespersonCount,
      companyCounts: [...companies.entries()]
        .map(([companyId, value]) => ({
          companyId,
          totalCount: SALE_ORDER_SOURCE_STATES.reduce(
            (sum, state) => sum + value.states[state],
            0,
          ),
          stateCounts: value.states,
          missingSalespersonCount: value.missing,
        }))
        .sort((left, right) => left.companyId - right.companyId),
    };
  }
}
