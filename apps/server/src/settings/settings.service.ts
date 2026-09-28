import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { settings } from '../database/schema.js';

/** Instance-wide settings stored as key/value pairs in the database. */
@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async get<T>(key: string): Promise<T | undefined> {
    const row = await this.db.query.settings.findFirst({ where: eq(settings.key, key) });
    return row?.value as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(settings).where(eq(settings.key, key));
  }
}
