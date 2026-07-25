import { readRuntimeConfig } from '@ertip/config';
import { createDatabasePool, queryMonthlyQuotationReport } from '@ertip/db';
import type {
  MonthlyQuotationReportFilters,
  MonthlyQuotationReportResult,
} from '@ertip/reporting';

import { getAppDatabase } from './database';

type ReportingPool = ReturnType<typeof createDatabasePool>;

interface ReportingGlobalState {
  pool?: ReportingPool;
  connectionString?: string;
}

const globalState = globalThis as typeof globalThis & {
  __ertipReportingState?: ReportingGlobalState;
};

function getGlobalState(): ReportingGlobalState {
  globalState.__ertipReportingState ??= {};
  return globalState.__ertipReportingState;
}

function getReportingPool(): ReportingPool {
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

export async function getMonthlyQuotationReport(input: {
  readonly filters: MonthlyQuotationReportFilters;
  readonly allowedBusinessUnitIds: readonly string[];
  readonly generatedAt?: Date;
  readonly detailLimit?: number;
}): Promise<MonthlyQuotationReportResult> {
  await getAppDatabase();
  return queryMonthlyQuotationReport(getReportingPool(), input);
}
