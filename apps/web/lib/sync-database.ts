import { readRuntimeConfig } from '@ertip/config';
import { createDatabasePool, SyncDatabase } from '@ertip/db';

interface SyncDatabaseGlobalState {
  database?: SyncDatabase;
  connectionString?: string;
  migration?: Promise<void>;
}

const globalState = globalThis as typeof globalThis & {
  __ertipSyncDatabaseState?: SyncDatabaseGlobalState;
};

function getGlobalState(): SyncDatabaseGlobalState {
  globalState.__ertipSyncDatabaseState ??= {};
  return globalState.__ertipSyncDatabaseState;
}

export async function getSyncDatabase(): Promise<SyncDatabase> {
  const runtime = readRuntimeConfig();
  const connectionString = runtime.database.connectionString;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const state = getGlobalState();

  if (!state.database || state.connectionString !== connectionString) {
    state.database = new SyncDatabase(
      createDatabasePool({
        connectionString,
        ssl: runtime.database.ssl,
        maxConnections: 4,
      }),
    );
    state.connectionString = connectionString;
    delete state.migration;
  }

  state.migration ??= state.database.migrate();
  await state.migration;
  return state.database;
}
