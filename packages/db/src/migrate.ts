import { AppDatabase, createDatabasePool } from './database.ts';

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run migrations.');
}

const database = new AppDatabase(
  createDatabasePool({
    connectionString,
    ssl: process.env.DATABASE_SSL?.trim().toLowerCase() === 'true',
    maxConnections: 1,
  }),
);

try {
  await database.migrate();
  const version = await database.getSchemaVersion();
  console.log(`[database] schema version ${version ?? 'unknown'} is ready.`);
} finally {
  await database.close();
}
