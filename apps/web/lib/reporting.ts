import type { Pool } from 'pg';

import { createDatabasePool, queryMonthlyQuotationReport } from '@ertip/db';
import { readRuntimeConfig } from '@ertip/config';
import type {
  MonthlyQuotationReportFilters,
  MonthlyQuotationReportResult,
} from '@ertip/reporting';

import { getAppDatabase } from './database';

interface ReportingGlobalState {
  pool?: Pool;
  connectionString?: string;
}

const globalState = globalThis as typeof globalThis & {
  __ertipReportingState?: ReportingGlobalState;
};

function getGlobalState(): ReportingGlobalState {
  globalState.__ertipReportingState ??= {};
  return globalState.__ertipReportingState;
}

function getReportingPool(): Pool {
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
