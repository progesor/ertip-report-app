import { readRuntimeConfig } from '@ertip/config';
import {
  createDatabasePool,
  recoverInterruptedSyncRuns,
  SyncDatabase,
} from '@ertip/db';
import { createOdooClient } from '@ertip/odoo-client';
import { runSaleOrderSync, SaleOrderSyncError } from '@ertip/sync';

const runtime = readRuntimeConfig();
const heartbeatMs = 30_000;
const pollMs = 5_000;
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

async function initializeWorker(): Promise<void> {
  if (!syncDatabase || !databasePool) {
    console.warn(
      JSON.stringify({ event: 'worker.sync.disabled', reason: 'DATABASE_NOT_CONFIGURED' }),
    );
    return;
  }

  await syncDatabase.migrate();
  const recoveredRuns = await recoverInterruptedSyncRuns(databasePool);

  if (recoveredRuns > 0) {
    console.warn(JSON.stringify({ event: 'worker.sync.recovered', recoveredRuns }));
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
      const completed = await runSaleOrderSync({ client, store: syncDatabase, run });
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
      const safeErrorCode =
        error instanceof SaleOrderSyncError ? error.code : 'UNEXPECTED_SYNC_FAILURE';
      const errorStage = error instanceof SaleOrderSyncError ? error.stage : 'worker';
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
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'worker.poll.failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  } finally {
    processing = false;
  }
}

await initializeWorker();
console.info(JSON.stringify({ event: 'worker.started', ...safeWorkerState() }));
void processNextSyncRun();

const poller = setInterval(() => {
  void processNextSyncRun();
}, pollMs);
const heartbeat = setInterval(() => {
  console.info(JSON.stringify({ event: 'worker.heartbeat', ...safeWorkerState() }));
}, heartbeatMs);

async function shutdown(signal: string): Promise<void> {
  stopping = true;
  clearInterval(poller);
  clearInterval(heartbeat);

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
