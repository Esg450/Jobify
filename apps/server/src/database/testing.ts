import type { Client } from '@libsql/client';
import { openDatabase, type Database } from './database.js';
import { users, type UserRole } from './schema.js';

export interface TestDatabase {
  client: Client;
  db: Database;
  /** Inserts a user directly, skipping password hashing to keep tests fast. */
  createUser(username: string, role?: UserRole): Promise<number>;
}

/** An in-memory database with all migrations applied. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const { client, db } = await openDatabase(':memory:');
  return {
    client,
    db,
    async createUser(username, role = 'user') {
      const [user] = await db
        .insert(users)
        .values({ username, displayName: username, passwordHash: 'unused', role })
        .returning({ id: users.id });
      return user.id;
    },
  };
}
