import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, isNull, ne } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobs, sessions, users, type User, type UserProfile } from '../database/schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { EMPTY_PROFILE, type ProfileDto } from './profile.dto.js';
import type { PreferencesDto } from './preferences.dto.js';
import { normalizeDashboard, type UserPreferences } from './preferences.js';
import type { CreateUserDto, UpdateUserDto } from './users.dto.js';

/** A user as exposed by the API: never includes the password hash or profile. */
export type PublicUser = Pick<User, 'id' | 'username' | 'displayName' | 'role' | 'createdAt'>;

const publicColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  role: users.role,
  createdAt: users.createdAt,
};

/** Settings keys left over from the single-user version. */
const LEGACY_PROFILE_KEY = 'profile';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  async count(): Promise<number> {
    const [{ total }] = await this.db.select({ total: count() }).from(users);
    return total;
  }

  list(): Promise<PublicUser[]> {
    return this.db.select(publicColumns).from(users).orderBy(users.username);
  }

  async findById(id: number): Promise<PublicUser> {
    const [user] = await this.db.select(publicColumns).from(users).where(eq(users.id, id));
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /** Returns the user if the credentials are valid. */
  async authenticate(username: string, password: string): Promise<PublicUser | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.username, username.toLowerCase()),
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
    return this.findById(user.id);
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const username = dto.username.toLowerCase();
    await this.assertUsernameAvailable(username);

    const [user] = await this.db
      .insert(users)
      .values({
        username,
        displayName: dto.displayName?.trim() || dto.username,
        passwordHash: await hashPassword(dto.password),
        role: dto.role ?? 'user',
      })
      .returning(publicColumns);
    return user;
  }

  /**
   * Creates the first admin and hands over data from the single-user version: jobs without
   * an owner and the old instance-wide profile.
   */
  async createFirstAdmin(dto: CreateUserDto): Promise<PublicUser> {
    const admin = await this.create({ ...dto, role: 'admin' });
    const legacyProfile = await this.settings.get<UserProfile>(LEGACY_PROFILE_KEY);

    await this.db.transaction(async (tx) => {
      await tx.update(jobs).set({ userId: admin.id }).where(isNull(jobs.userId));
      if (legacyProfile)
        await tx.update(users).set({ profile: legacyProfile }).where(eq(users.id, admin.id));
    });
    if (legacyProfile) await this.settings.delete(LEGACY_PROFILE_KEY);
    return admin;
  }

  async update(id: number, dto: UpdateUserDto): Promise<PublicUser> {
    const existing = await this.findById(id);
    const username = dto.username?.toLowerCase();
    if (username && username !== existing.username) await this.assertUsernameAvailable(username);
    if (dto.role === 'user' && existing.role === 'admin') await this.assertNotLastAdmin(id);

    await this.db
      .update(users)
      .set({
        username,
        displayName: dto.displayName?.trim() || undefined,
        role: dto.role,
        passwordHash: dto.password ? await hashPassword(dto.password) : undefined,
      })
      .where(eq(users.id, id));

    // A new password or a demotion should take effect everywhere immediately.
    if (dto.password || dto.role) await this.db.delete(sessions).where(eq(sessions.userId, id));
    return this.findById(id);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findById(id);
    if (user.role === 'admin') await this.assertNotLastAdmin(id);
    // Jobs, events and sessions are removed by ON DELETE CASCADE.
    await this.db.delete(users).where(eq(users.id, id));
  }

  async changePassword(id: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Your current password is incorrect');
    }
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(users.id, id));
  }

  async getProfile(id: number): Promise<UserProfile> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { profile: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return { ...EMPTY_PROFILE, ...user.profile };
  }

  async updateProfile(id: number, changes: ProfileDto): Promise<UserProfile> {
    const profile = { ...(await this.getProfile(id)), ...changes };
    await this.db.update(users).set({ profile }).where(eq(users.id, id));
    return profile;
  }

  async getPreferences(id: number): Promise<UserPreferences> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { preferences: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return { dashboard: normalizeDashboard(user.preferences.dashboard) };
  }

  async updatePreferences(id: number, changes: PreferencesDto): Promise<UserPreferences> {
    const preferences = { ...(await this.getPreferences(id)), ...changes };
    preferences.dashboard = normalizeDashboard(preferences.dashboard);
    await this.db.update(users).set({ preferences }).where(eq(users.id, id));
    return preferences;
  }

  private async assertUsernameAvailable(username: string): Promise<void> {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.username, username),
      columns: { id: true },
    });
    if (existing) throw new ConflictException(`The username "${username}" is already taken`);
  }

  private async assertNotLastAdmin(id: number): Promise<void> {
    const [{ others }] = await this.db
      .select({ others: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), ne(users.id, id)));
    if (others === 0) throw new BadRequestException('Jobify needs at least one admin');
  }
}
