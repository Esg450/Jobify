import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { settings } from '../database/schema.js';
import { EMPTY_PROFILE, type Profile, type ProfileDto } from './profile.dto.js';

const PROFILE_KEY = 'profile';

/** A small key/value store for user preferences that live in the database. */
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

  async getProfile(): Promise<Profile> {
    return { ...EMPTY_PROFILE, ...(await this.get<Profile>(PROFILE_KEY)) };
  }

  async updateProfile(changes: ProfileDto): Promise<Profile> {
    const profile = { ...(await this.getProfile()), ...changes };
    await this.set(PROFILE_KEY, profile);
    return profile;
  }
}
