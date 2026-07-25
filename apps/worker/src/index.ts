import { readRuntimeConfig } from '@ertip/config';
import {
  createDatabasePool,
  recoverInterruptedSyncRuns,
  SyncDatabase,
  type SaleOrderSyncCounts,
} from '@ertip/db';
import { createOdooClient } from '@ertip/odoo-client';
import {
  runSaleOrderSync,
  SaleOrderSyncError,
  type SaleOrderSyncStore,
} from '@ertip/sync';

const runtime = readRuntimeConfig();
const heartbeatMs = 30_000;
const pollMs = 5_000;
const startupRetryMaximumMs = 30_000;
const databasePool = runtime.database.connectionString
  ? createDatabasePool({
      connectionString: runtime.database.connectionString,
      ssl: runtime.database.ssl,
      maxConnections: 4,
    })
  : null;
const syncDatabase = databasePool ? new SyncDatabase(databasePool) : null;
let processing = false;
let stopping = false;
let poller: ReturnType<typeof setInterval> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

function safeWorkerState() {
  return {
    service: 'ertip-report-worker',
    environment: runtime.appEnvironment,
    demoMode: runtime.demoMode,
    databaseConfigured: runtime.database.configured,
    odooConfigured: runtime.odoo.configured,
    processing,
    timestamp: new Date().toISOString(),
  };
}

function compactZeroCompanyCounts(counts: SaleOrderSyncCounts): SaleOrderSyncCounts {
  return {
    ...counts,
    companyCounts: counts.companyCounts.filter(
      (company) =>
        company.totalCount > 0 ||
        company.missingSalespersonCount > 0 ||
        Object.values(company.stateCounts).some((count) => count > 0),
    ),
  };
}

function createSyncStore(database: SyncDatabase): SaleOrderSyncStore {
  return {
    getBusinessUnitMappings: () => database.getBusinessUnitMappings(),
    setSaleOrderSyncSourceCount: (runId, sourceCount) =>
      database.setSaleOrderSyncSourceCount(runId, sourceCount),
    applySaleOrderSyncBatch: (runId, batch, cursorSourceId) =>
      database.applySaleOrderSyncBatch(runId, batch, cursorSourceId),
    finalizeSaleOrderSync: (runId, sourceCounts) =>
      database.finalizeSaleOrderSync(runId, compactZeroCompanyCounts(sourceCounts)),
  };
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getSafeErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' && /^[A-Z0-9_]+$/i.test(code) ? code : null;
}

async function initializeWorker(): Promise<void> {
  if (!syncDatabase || !databasePool) {
    console.warn(
      JSON.stringify({ event: 'worker.sync.disabled', reason: 'DATABASE_NOT_CONFIGURED' }),
    );
    return;
  }

  let attempt = 0;

  while (!stopping) {
    try {
      await syncDatabase.migrate();
      const recoveredRuns = await recoverInterruptedSyncRuns(databasePool);

      if (recoveredRuns > 0) {
        console.warn(JSON.stringify({ event: 'worker.sync.recovered', recoveredRuns }));
      }

      console.info(
        JSON.stringify({
          event: 'worker.database.ready',
          attempts: attempt + 1,
          ...safeWorkerState(),
        }),
      );
      return;
    } catch (error) {
      attempt += 1;
      const retryInMs = Math.min(
        startupRetryMaximumMs,
        1_000 * 2 ** Math.min(attempt - 1, 5),
      );
      console.error(
        JSON.stringify({
          event: 'worker.database.retry',
          attempt,
          retryInMs,
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorCode: getSafeErrorCode(error),
          ...safeWorkerState(),
        }),
      );
      await wait(retryInMs);
    }
  }
}

async function processNextSyncRun(): Promise<void> {
  if (processing || stopping || !syncDatabase) {
    return;
  }

  if (
    !runtime.odoo.configured ||
    !runtime.odoo.baseUrl ||
    !runtime.odoo.database ||
    !runtime.odoo.apiKey
  ) {
    return;
  }

  processing = true;

  try {
    const run = await syncDatabase.claimNextSaleOrderSync();

    if (!run) {
      return;
    }

    console.info(
      JSON.stringify({
        event: 'worker.sync.started',
        runId: run.id,
        dateFrom: run.dateFrom,
        dateTo: run.dateTo,
        cursorSourceId: run.cursorSourceId,
      }),
    );
    const client = createOdooClient({
      baseUrl: runtime.odoo.baseUrl,
      database: runtime.odoo.database,
      apiKey: runtime.odoo.apiKey,
      timeoutMs: runtime.odoo.timeoutMs,
    });

    try {
      const completed = await runSaleOrderSync({
        client,
        store: createSyncStore(syncDatabase),
        run,
      });
      console.info(
        JSON.stringify({
          event: 'worker.sync.completed',
          runId: completed.id,
          status: completed.status,
          sourceCount: completed.sourceCount,
          processedCount: completed.processedCount,
          deletedStaleOrders: completed.deletedStaleOrders,
          reconciles: completed.reconciles,
        }),
      );
    } catch (error) {
      const syncError = error instanceof SaleOrderSyncError ? error : null;
      const safeErrorCode = syncError?.code ?? 'UNEXPECTED_SYNC_FAILURE';
      const errorStage = syncError?.stage ?? 'worker';
      await syncDatabase.failSaleOrderSync({
        runId: run.id,
        safeErrorCode,
        errorStage,
      });
      console.error(
        JSON.stringify({
          event: 'worker.sync.failed',
          runId: run.id,
          safeErrorCode,
          errorStage,
          sourceRecordId: syncError?.sourceRecordId ?? null,
          sourceField: syncError?.sourceField ?? null,
          sourceValueType: syncError?.sourceValueType ?? null,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'worker.poll.failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorCode: getSafeErrorCode(error),
      }),
    );
  } finally {
    processing = false;
  }
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) {
    return;
  }

  stopping = true;

  if (poller) {
    clearInterval(poller);
  }

  if (heartbeat) {
    clearInterval(heartbeat);
  }

  if (syncDatabase) {
    await syncDatabase.close();
  }

  console.info(JSON.stringify({ event: 'worker.stopped', signal, ...safeWorkerState() }));
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

console.info(JSON.stringify({ event: 'worker.booting', ...safeWorkerState() }));
await initializeWorker();
console.info(JSON.stringify({ event: 'worker.started', ...safeWorkerState() }));
void processNextSyncRun();

poller = setInterval(() => {
  void processNextSyncRun();
}, pollMs);
heartbeat = setInterval(() => {
  console.info(JSON.stringify({ event: 'worker.heartbeat', ...safeWorkerState() }));
}, heartbeatMs);
