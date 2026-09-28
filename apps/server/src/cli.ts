/**
 * Maintenance commands, run inside the container:
 *
 *   docker exec -it jobify node apps/server/dist/cli.js list-users
 *   docker exec -it jobify node apps/server/dist/cli.js reset-password <username>
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { loadConfig } from './config/configuration.js';
import { openDatabase, type Database } from './database/database.js';
import { sessions, users } from './database/schema.js';
import { generatePassword, hashPassword } from './users/passwords.js';

const USAGE = 'Usage: cli.js list-users | reset-password <username>';

// `docker exec` runs as root. Switch to the app's user so any files SQLite creates
// (such as the write-ahead log) stay writable by the server.
function dropPrivileges(): void {
  if (process.getuid?.() !== 0 || !process.env.PUID) return;
  process.setgid!(Number(process.env.PGID ?? process.env.PUID));
  process.setuid!(Number(process.env.PUID));
}

async function listUsers(db: Database): Promise<number> {
  const rows = await db.select().from(users).orderBy(users.username);
  if (rows.length === 0) console.log('No users yet. Open Jobify in a browser to create the admin.');
  for (const user of rows) console.log(`${user.username}\t${user.role}\t${user.displayName}`);
  return 0;
}

async function resetPassword(db: Database, username: string): Promise<number> {
  const password = generatePassword();
  const [user] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.username, username.toLowerCase()))
    .returning({ id: users.id });
  if (!user) {
    console.error(`No user named "${username}". Run list-users to see who exists.`);
    return 1;
  }

  await db.delete(sessions).where(eq(sessions.userId, user.id));
  console.log(`New password for ${username.toLowerCase()}: ${password}`);
  console.log('Sign in with it, then change it under Settings → Account.');
  return 0;
}

async function main([command, username]: string[]): Promise<number> {
  if (command !== 'list-users' && !(command === 'reset-password' && username)) {
    console.error(USAGE);
    return 1;
  }

  dropPrivileges();
  const file = path.join(loadConfig().dataDir, 'jobify.db');
  if (!existsSync(file)) {
    console.error(`No database found at ${file}. Is DATA_DIR set correctly?`);
    return 1;
  }

  const { client, db } = await openDatabase(`file:${file}`);
  try {
    return command === 'list-users' ? await listUsers(db) : await resetPassword(db, username);
  } finally {
    client.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
