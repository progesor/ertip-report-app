import { AppDatabase, createDatabasePool } from '@ertip/db';
import { readRuntimeConfig } from '@ertip/config';

interface DatabaseGlobalState {
  database?: AppDatabase;
  databaseConnectionString?: string;
  migration?: Promise<void>;
}

const globalState = globalThis as typeof globalThis & {
  __ertipDatabaseState?: DatabaseGlobalState;
};

function getGlobalState(): DatabaseGlobalState {
  globalState.__ertipDatabaseState ??= {};
  return globalState.__ertipDatabaseState;
}

export class DatabaseConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

export async function getAppDatabase(): Promise<AppDatabase> {
  const runtime = readRuntimeConfig();
  const connectionString = runtime.database.connectionString;

  if (!connectionString) {
    throw new DatabaseConfigurationError('DATABASE_URL is not configured.');
  }

  const state = getGlobalState();

  if (!state.database || state.databaseConnectionString !== connectionString) {
    state.database = new AppDatabase(
      createDatabasePool({
        connectionString,
        ssl: runtime.database.ssl,
        maxConnections: 5,
      }),
    );
    state.databaseConnectionString = connectionString;
    state.migration = undefined;
  }

  state.migration ??= state.database.migrate();
  await state.migration;
  return state.database;
}

export async function getDatabaseHealth(): Promise<{
  readonly configured: boolean;
  readonly reachable: boolean;
  readonly schemaVersion: number | null;
  readonly userCount: number | null;
  readonly errorCode: string | null;
}> {
  const runtime = readRuntimeConfig();

  if (!runtime.database.configured) {
    return {
      configured: false,
      reachable: false,
      schemaVersion: null,
      userCount: null,
      errorCode: 'DATABASE_NOT_CONFIGURED',
    };
  }

  try {
    const database = await getAppDatabase();
    await database.ping();
    const [schemaVersion, userCount] = await Promise.all([
      database.getSchemaVersion(),
      database.countUsers(),
    ]);

    return {
      configured: true,
      reachable: true,
      schemaVersion,
      userCount,
      errorCode: null,
    };
  } catch (error) {
    console.error('[database] health check failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });

    return {
      configured: true,
      reachable: false,
      schemaVersion: null,
      userCount: null,
      errorCode: 'DATABASE_UNREACHABLE',
    };
  }
}
