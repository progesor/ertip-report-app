import { OdooClientError, type OdooClient } from './client.ts';

const DEFAULT_STATES = [
  { value: 'draft', label: 'Quotation' },
  { value: 'sent', label: 'Quotation Sent' },
  { value: 'sale', label: 'Sales Order' },
  { value: 'cancel', label: 'Cancelled' },
] as const;

const RETRYABLE_ERROR_CODES = new Set([
  'TIMEOUT',
  'NETWORK_ERROR',
  'RATE_LIMITED',
  'ODOO_UNAVAILABLE',
]);

type OdooDomain = readonly (readonly unknown[])[];
type OdooRecord = Readonly<Record<string, unknown>>;

interface OdooFieldDefinition {
  readonly selection?: unknown;
}

export interface SaleOrderCoverageStateCount {
  readonly value: string;
  readonly label: string;
  readonly count: number | null;
}

export interface SaleOrderCompanyCoverage {
  readonly companyId: number;
  readonly companyName: string;
  readonly totalCount: number | null;
  readonly stateCounts: readonly SaleOrderCoverageStateCount[];
  readonly missingSalespersonCount: number | null;
  readonly reconcilesTotal: boolean | null;
}

export interface UnassignedSaleOrderSample {
  readonly id: number;
  readonly companyId: number | null;
  readonly state: string | null;
  readonly createDate: string | null;
  readonly dateOrder: string | null;
}

export interface SaleOrderCoverageResult {
  readonly generatedAt: string;
  readonly totalCount: number | null;
  readonly stateCounts: readonly SaleOrderCoverageStateCount[];
  readonly missingSalespersonCount: number | null;
  readonly reconcilesTotal: boolean | null;
  readonly companyCoverage: readonly SaleOrderCompanyCoverage[];
  readonly unassignedSamples: readonly UnassignedSaleOrderSample[];
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function readWithRetry<TResult>(operation: () => Promise<TResult>): Promise<TResult | null> {
  const maximumAttempts = 3;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof OdooClientError)) {
        throw error;
      }

      const canRetry = RETRYABLE_ERROR_CODES.has(error.code) && attempt < maximumAttempts;

      if (!canRetry) {
        return null;
      }

      await wait(150 * attempt);
    }
  }

  return null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readMany2OneId(value: unknown): number | null {
  return Array.isArray(value) ? readNumber(value[0]) : null;
}

function readSelection(value: unknown): readonly { readonly value: string; readonly label: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') {
      return [];
    }

    return [{ value: entry[0], label: entry[1] }];
  });
}

async function readStates(
  client: OdooClient,
): Promise<readonly { readonly value: string; readonly label: string }[]> {
  const fields = await readWithRetry(() =>
    client.call<Readonly<Record<string, OdooFieldDefinition>>>('sale.order', 'fields_get', {
      fields: ['state'],
      attributes: ['selection'],
    }),
  );
  const discovered = readSelection(fields?.state?.selection);
  return discovered.length > 0 ? discovered : DEFAULT_STATES;
}

async function readCount(client: OdooClient, domain: OdooDomain): Promise<number | null> {
  return readWithRetry(() => client.call<number>('sale.order', 'search_count', { domain }));
}

function reconcile(
  totalCount: number | null,
  stateCounts: readonly SaleOrderCoverageStateCount[],
): boolean | null {
  if (totalCount === null || stateCounts.some(({ count }) => count === null)) {
    return null;
  }

  return stateCounts.reduce((sum, { count }) => sum + (count ?? 0), 0) === totalCount;
}

async function readCompanyRecords(client: OdooClient): Promise<readonly OdooRecord[]> {
  const records = await readWithRetry(() =>
    client.call<readonly OdooRecord[]>('res.company', 'search_read', {
      domain: [],
      fields: ['id', 'name'],
      order: 'id asc',
      limit: 200,
    }),
  );

  if (!records) {
    throw new OdooClientError('Company coverage could not be read.', {
      code: 'COMPANY_COVERAGE_UNAVAILABLE',
    });
  }

  return records;
}

async function readStateCounts(
  client: OdooClient,
  states: readonly { readonly value: string; readonly label: string }[],
  baseDomain: OdooDomain,
): Promise<readonly SaleOrderCoverageStateCount[]> {
  const counts: SaleOrderCoverageStateCount[] = [];

  for (const state of states) {
    counts.push({
      ...state,
      count: await readCount(client, [...baseDomain, ['state', '=', state.value]]),
    });
  }

  return counts;
}

async function readUnassignedSamples(client: OdooClient): Promise<readonly UnassignedSaleOrderSample[]> {
  const records = await readWithRetry(() =>
    client.call<readonly OdooRecord[]>('sale.order', 'search_read', {
      domain: [['user_id', '=', false]],
      fields: ['id', 'company_id', 'state', 'create_date', 'date_order'],
      order: 'create_date desc, id desc',
      limit: 20,
    }),
  );

  if (!records) {
    return [];
  }

  return records.flatMap((record) => {
    const id = readNumber(record.id);

    if (id === null) {
      return [];
    }

    return [
      {
        id,
        companyId: readMany2OneId(record.company_id),
        state: readString(record.state),
        createDate: readString(record.create_date),
        dateOrder: readString(record.date_order),
      },
    ];
  });
}

export async function discoverSaleOrderCoverage(client: OdooClient): Promise<SaleOrderCoverageResult> {
  const companies = await readCompanyRecords(client);
  const states = await readStates(client);
  const totalCount = await readCount(client, []);
  const stateCounts = await readStateCounts(client, states, []);
  const missingSalespersonCount = await readCount(client, [['user_id', '=', false]]);
  const companyCoverage: SaleOrderCompanyCoverage[] = [];

  for (const company of companies) {
    const companyId = readNumber(company.id);

    if (companyId === null) {
      continue;
    }

    const companyName = readString(company.name) ?? `Şirket #${companyId}`;
    const baseDomain: OdooDomain = [['company_id', '=', companyId]];
    const companyTotalCount = await readCount(client, baseDomain);
    const companyStateCounts = await readStateCounts(client, states, baseDomain);
    const companyMissingSalespersonCount = await readCount(client, [
      ...baseDomain,
      ['user_id', '=', false],
    ]);

    companyCoverage.push({
      companyId,
      companyName,
      totalCount: companyTotalCount,
      stateCounts: companyStateCounts,
      missingSalespersonCount: companyMissingSalespersonCount,
      reconcilesTotal: reconcile(companyTotalCount, companyStateCounts),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCount,
    stateCounts,
    missingSalespersonCount,
    reconcilesTotal: reconcile(totalCount, stateCounts),
    companyCoverage,
    unassignedSamples: await readUnassignedSamples(client),
  };
}
