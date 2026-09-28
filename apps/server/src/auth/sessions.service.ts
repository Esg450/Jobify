import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { sessions, users } from '../database/schema.js';
import type { PublicUser } from '../users/users.service.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Sessions are random tokens; only their SHA-256 hash is stored, so a leaked database can't be used to log in. */
@Injectable()
export class SessionsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(userId: number, now = Date.now()): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.db.insert(sessions).values({
      id: SessionsService.hash(token),
      userId,
      expiresAt: new Date(now + SESSION_TTL_MS),
    });
    // Opportunistic cleanup keeps the table small without a scheduled job.
    await this.db.delete(sessions).where(lt(sessions.expiresAt, new Date(now)));
    return token;
  }

  async findUser(token: string | undefined, now = Date.now()): Promise<PublicUser | null> {
    if (!token) return null;
    const [row] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(eq(sessions.id, SessionsService.hash(token)), gt(sessions.expiresAt, new Date(now))),
      );
    return row ?? null;
  }

  async revoke(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, SessionsService.hash(token)));
  }

  /** Signs the user out everywhere, optionally except for the current session. */
  async revokeAll(userId: number, exceptToken?: string): Promise<void> {
    const keep = exceptToken ? ne(sessions.id, SessionsService.hash(exceptToken)) : undefined;
    await this.db.delete(sessions).where(and(eq(sessions.userId, userId), keep));
  }

  private static hash(token: string): string {
    return createHash('sha256').update(token).digest('base64url');
  }
}
