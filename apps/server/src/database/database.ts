import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { SERVER_ROOT } from '../config/configuration.js';
import * as schema from './schema.js';

export type Database = LibSQLDatabase<typeof schema>;
/** The database or an open transaction, for helpers that have to work inside either. */
export type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'drizzle');

/** Opens a SQLite database (e.g. "file:/data/jobify.db" or ":memory:") and applies migrations. */
export async function openDatabase(url: string): Promise<{ client: Client; db: Database }> {
  const client = createClient({ url });
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');

  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { client, db };
}
