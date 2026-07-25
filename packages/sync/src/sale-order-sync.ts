import {
  SALE_ORDER_SOURCE_STATES,
  type BusinessUnitOdooMapping,
  type SaleOrderSourceState,
  type SaleOrderSyncBatch,
  type SaleOrderSyncCounts,
  type SaleOrderSyncCustomerInput,
  type SaleOrderSyncOrderInput,
  type SaleOrderSyncRun,
  type SaleOrderSyncSalespersonInput,
  type SyncDatabase,
} from '@ertip/db';
import { OdooClientError, type OdooClient } from '@ertip/odoo-client';

const RETRYABLE_ERROR_CODES = new Set([
  'TIMEOUT',
  'NETWORK_ERROR',
  'RATE_LIMITED',
  'ODOO_UNAVAILABLE',
]);

const SALE_ORDER_FIELDS = [
  'id',
  'company_id',
  'user_id',
  'partner_id',
  'currency_id',
  'state',
  'create_date',
  'date_order',
  'validity_date',
  'amount_total',
  'write_date',
] as const;

const USER_FIELDS = ['id', 'name', 'active', 'company_id', 'write_date'] as const;
const PARTNER_FIELDS = [
  'id',
  'name',
  'active',
  'company_id',
  'commercial_partner_id',
  'customer_rank',
  'write_date',
] as const;

type OdooRecord = Readonly<Record<string, unknown>>;
type SyncStage = 'source-count' | 'page-read' | 'reference-read' | 'database-write' | 'reconciliation';

export class SaleOrderSyncError extends Error {
  public readonly code: string;
  public readonly stage: SyncStage;

  public constructor(message: string, options: { readonly code: string; readonly stage: SyncStage; readonly cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SaleOrderSyncError';
    this.code = options.code;
    this.stage = options.stage;
  }
}

export interface SaleOrderSyncStore {
  readonly getBusinessUnitMappings: SyncDatabase['getBusinessUnitMappings'];
  readonly setSaleOrderSyncSourceCount: SyncDatabase['setSaleOrderSyncSourceCount'];
  readonly applySaleOrderSyncBatch: SyncDatabase['applySaleOrderSyncBatch'];
  readonly finalizeSaleOrderSync: SyncDatabase['finalizeSaleOrderSync'];
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function callWithRetry<TResult>(
  stage: SyncStage,
  operation: () => Promise<TResult>,
): Promise<TResult> {
  const maximumAttempts = 4;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof OdooClientError)) {
        throw new SaleOrderSyncError('Unexpected sync dependency failure.', {
          code: 'UNEXPECTED_DEPENDENCY_ERROR',
          stage,
          cause: error,
        });
      }

      const canRetry = RETRYABLE_ERROR_CODES.has(error.code) && attempt < maximumAttempts;

      if (!canRetry) {
        throw new SaleOrderSyncError('Odoo read failed during synchronization.', {
          code: `ODOO_${error.code}`,
          stage,
          cause: error,
        });
      }

      await wait(250 * attempt);
    }
  }

  throw new SaleOrderSyncError('Odoo retry budget was exhausted.', {
    code: 'ODOO_RETRY_EXHAUSTED',
    stage,
  });
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readMany2OneId(value: unknown): number | null {
  return Array.isArray(value) ? readNumber(value[0]) : null;
}

function readRequiredNumber(record: OdooRecord, field: string): number {
  const value = readNumber(record[field]);

  if (value === null) {
    throw new SaleOrderSyncError(`Required numeric field is missing: ${field}`, {
      code: 'INVALID_SOURCE_RECORD',
      stage: 'page-read',
    });
  }

  return value;
}

function readRequiredMany2One(record: OdooRecord, field: string): number {
  const value = readMany2OneId(record[field]);

  if (value === null) {
    throw new SaleOrderSyncError(`Required relation field is missing: ${field}`, {
      code: 'INVALID_SOURCE_RECORD',
      stage: 'page-read',
    });
  }

  return value;
}

function readRequiredString(record: OdooRecord, field: string): string {
  const value = readString(record[field]);

  if (value === null) {
    throw new SaleOrderSyncError(`Required text field is missing: ${field}`, {
      code: 'INVALID_SOURCE_RECORD',
      stage: 'page-read',
    });
  }

  return value;
}

function readSourceState(record: OdooRecord): SaleOrderSourceState {
  const state = readRequiredString(record, 'state');

  if (!SALE_ORDER_SOURCE_STATES.includes(state as SaleOrderSourceState)) {
    throw new SaleOrderSyncError(`Unsupported sale.order state: ${state}`, {
      code: 'UNSUPPORTED_SOURCE_STATE',
      stage: 'page-read',
    });
  }

  return state as SaleOrderSourceState;
}

function buildScopeDomain(run: SaleOrderSyncRun): unknown[] {
  const domain: unknown[] = [];

  if (run.dateFrom !== null) {
    domain.push(['create_date', '>=', `${run.dateFrom} 00:00:00`]);
  }

  if (run.dateTo !== null) {
    domain.push(['create_date', '<', `${run.dateTo} 00:00:00`]);
  }

  return domain;
}

function uniqueNumbers(values: readonly (number | null)[]): readonly number[] {
  return [...new Set(values.filter((value): value is number => value !== null))].sort(
    (left, right) => left - right,
  );
}

function createStateCounts(): Record<SaleOrderSourceState, number> {
  return { draft: 0, sent: 0, sale: 0, cancel: 0 };
}

async function readCount(
  client: OdooClient,
  domain: readonly unknown[],
): Promise<number> {
  return callWithRetry('source-count', () =>
    client.call<number>('sale.order', 'search_count', { domain }),
  );
}

async function readSourceCounts(
  client: OdooClient,
  run: SaleOrderSyncRun,
  mappings: readonly BusinessUnitOdooMapping[],
): Promise<SaleOrderSyncCounts> {
  const scopeDomain = buildScopeDomain(run);
  const stateCounts = createStateCounts();
  const totalCount = await readCount(client, scopeDomain);
  const missingSalespersonCount = await readCount(client, [
    ...scopeDomain,
    ['user_id', '=', false],
  ]);

  for (const state of SALE_ORDER_SOURCE_STATES) {
    stateCounts[state] = await readCount(client, [...scopeDomain, ['state', '=', state]]);
  }

  const companyCounts = [];

  for (const mapping of mappings) {
    const companyDomain = [...scopeDomain, ['company_id', '=', mapping.odooCompanyId]];
    const companyStateCounts = createStateCounts();
    const companyTotalCount = await readCount(client, companyDomain);
    const companyMissingSalespersonCount = await readCount(client, [
      ...companyDomain,
      ['user_id', '=', false],
    ]);

    for (const state of SALE_ORDER_SOURCE_STATES) {
      companyStateCounts[state] = await readCount(client, [
        ...companyDomain,
        ['state', '=', state],
      ]);
    }

    companyCounts.push({
      companyId: mapping.odooCompanyId,
      totalCount: companyTotalCount,
      stateCounts: companyStateCounts,
      missingSalespersonCount: companyMissingSalespersonCount,
    });
  }

  return {
    totalCount,
    stateCounts,
    missingSalespersonCount,
    companyCounts,
  };
}

async function readReferenceRecords(
  client: OdooClient,
  model: 'res.users' | 'res.partner',
  ids: readonly number[],
  fields: readonly string[],
): Promise<readonly OdooRecord[]> {
  if (ids.length === 0) {
    return [];
  }

  return callWithRetry('reference-read', () =>
    client.call<readonly OdooRecord[]>(model, 'read', { ids, fields }),
  );
}

function mapSalespeople(records: readonly OdooRecord[]): readonly SaleOrderSyncSalespersonInput[] {
  return records.map((record) => ({
    odooUserId: readRequiredNumber(record, 'id'),
    displayName: readRequiredString(record, 'name'),
    active: readBoolean(record.active),
    defaultCompanyId: readMany2OneId(record.company_id),
    writeDate: readString(record.write_date),
  }));
}

function mapCustomers(records: readonly OdooRecord[]): readonly SaleOrderSyncCustomerInput[] {
  return records.map((record) => ({
    odooPartnerId: readRequiredNumber(record, 'id'),
    displayName: readRequiredString(record, 'name'),
    active: readBoolean(record.active),
    companyId: readMany2OneId(record.company_id),
    commercialPartnerId: readMany2OneId(record.commercial_partner_id),
    customerRank: readNumber(record.customer_rank),
    writeDate: readString(record.write_date),
  }));
}

function mapOrders(
  records: readonly OdooRecord[],
  mappings: ReadonlyMap<number, BusinessUnitOdooMapping>,
): readonly SaleOrderSyncOrderInput[] {
  return records.map((record) => {
    const companyId = readRequiredMany2One(record, 'company_id');
    const mapping = mappings.get(companyId);

    if (!mapping) {
      throw new SaleOrderSyncError(`No business-unit mapping exists for Odoo company ${companyId}.`, {
        code: 'UNMAPPED_COMPANY',
        stage: 'page-read',
      });
    }

    const amountTotal = readNumber(record.amount_total);

    if (amountTotal === null) {
      throw new SaleOrderSyncError('sale.order amount_total is missing or invalid.', {
        code: 'INVALID_SOURCE_RECORD',
        stage: 'page-read',
      });
    }

    return {
      odooId: readRequiredNumber(record, 'id'),
      businessUnitId: mapping.businessUnitId,
      odooCompanyId: companyId,
      odooSalespersonId: readMany2OneId(record.user_id),
      odooPartnerId: readRequiredMany2One(record, 'partner_id'),
      odooCurrencyId: readRequiredMany2One(record, 'currency_id'),
      sourceState: readSourceState(record),
      createDate: readRequiredString(record, 'create_date'),
      dateOrder: readRequiredString(record, 'date_order'),
      validityDate: readString(record.validity_date),
      amountTotal,
      writeDate: readRequiredString(record, 'write_date'),
    };
  });
}

async function readPage(
  client: OdooClient,
  run: SaleOrderSyncRun,
  cursorSourceId: number,
): Promise<readonly OdooRecord[]> {
  return callWithRetry('page-read', () =>
    client.call<readonly OdooRecord[]>('sale.order', 'search_read', {
      domain: [...buildScopeDomain(run), ['id', '>', cursorSourceId]],
      fields: SALE_ORDER_FIELDS,
      order: 'id asc',
      limit: run.pageSize,
    }),
  );
}

export async function runSaleOrderSync(input: {
  readonly client: OdooClient;
  readonly store: SaleOrderSyncStore;
  readonly run: SaleOrderSyncRun;
}): Promise<SaleOrderSyncRun> {
  const mappings = await input.store.getBusinessUnitMappings();

  if (mappings.length === 0) {
    throw new SaleOrderSyncError('No verified Odoo company mappings are configured.', {
      code: 'MISSING_COMPANY_MAPPINGS',
      stage: 'database-write',
    });
  }

  const mappingByCompanyId = new Map(mappings.map((mapping) => [mapping.odooCompanyId, mapping]));
  const sourceCounts = await readSourceCounts(input.client, input.run, mappings);
  await input.store.setSaleOrderSyncSourceCount(input.run.id, sourceCounts.totalCount);
  let cursorSourceId = input.run.cursorSourceId;

  while (true) {
    const records = await readPage(input.client, input.run, cursorSourceId);

    if (records.length === 0) {
      break;
    }

    const orders = mapOrders(records, mappingByCompanyId);
    const userIds = uniqueNumbers(orders.map((order) => order.odooSalespersonId));
    const partnerIds = uniqueNumbers(orders.map((order) => order.odooPartnerId));
    const [userRecords, partnerRecords] = await Promise.all([
      readReferenceRecords(input.client, 'res.users', userIds, USER_FIELDS),
      readReferenceRecords(input.client, 'res.partner', partnerIds, PARTNER_FIELDS),
    ]);
    const batch: SaleOrderSyncBatch = {
      salespeople: mapSalespeople(userRecords),
      customers: mapCustomers(partnerRecords),
      orders,
    };
    const finalRecordId = orders.at(-1)?.odooId;

    if (finalRecordId === undefined || finalRecordId <= cursorSourceId) {
      throw new SaleOrderSyncError('The Odoo page cursor did not advance.', {
        code: 'CURSOR_DID_NOT_ADVANCE',
        stage: 'page-read',
      });
    }

    try {
      await input.store.applySaleOrderSyncBatch(input.run.id, batch, finalRecordId);
    } catch (error) {
      throw new SaleOrderSyncError('The synchronized page could not be persisted.', {
        code: 'DATABASE_BATCH_FAILED',
        stage: 'database-write',
        cause: error,
      });
    }

    cursorSourceId = finalRecordId;

    if (records.length < input.run.pageSize) {
      break;
    }
  }

  try {
    const finalized = await input.store.finalizeSaleOrderSync(input.run.id, sourceCounts);
    return finalized.run;
  } catch (error) {
    if (error instanceof SaleOrderSyncError) {
      throw error;
    }

    throw new SaleOrderSyncError('The synchronized scope could not be reconciled.', {
      code: 'RECONCILIATION_FAILED',
      stage: 'reconciliation',
      cause: error,
    });
  }
}
