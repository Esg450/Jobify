import { BadRequestException, ConflictException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jobHunts, jobs } from '../database/schema.js';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { DASHBOARD_CARDS } from './preferences.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let database: TestDatabase;
  let settings: SettingsService;
  let users: UsersService;

  beforeEach(async () => {
    database = await createTestDatabase();
    settings = new SettingsService(database.db);
    users = new UsersService(database.db, settings, new HuntsService(database.db));
  });

  afterEach(() => database.client.close());

  it('creates users with case-insensitive usernames and authenticates them', async () => {
    const user = await users.create({ username: 'Alice', password: 'password123' });
    expect(user).toMatchObject({ username: 'alice', displayName: 'Alice', role: 'user' });
    expect(user).not.toHaveProperty('passwordHash');

    await expect(users.authenticate('ALICE', 'password123')).resolves.toMatchObject({
      id: user.id,
    });
    await expect(users.authenticate('alice', 'wrong')).resolves.toBeNull();
    await expect(
      users.create({ username: 'alice', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('gives the first admin the data from the single-user version', async () => {
    await database.db.insert(jobs).values({ title: 'Legacy job', company: 'Acme' });
    await settings.set('profile', { name: 'Old Me', resume: 'Experience' });

    const admin = await users.createFirstAdmin({ username: 'admin', password: 'password123' });

    expect(admin.role).toBe('admin');
    const [job] = await database.db.select().from(jobs);
    expect(job.userId).toBe(admin.id);
    // The claimed jobs become the admin's first job hunt.
    const [hunt] = await database.db.select().from(jobHunts);
    expect(hunt).toMatchObject({ userId: admin.id, endedOn: null });
    expect(job.huntId).toBe(hunt.id);
    await expect(users.getProfile(admin.id)).resolves.toMatchObject({
      name: 'Old Me',
      resume: 'Experience',
    });
    await expect(settings.get('profile')).resolves.toBeUndefined();
  });

  it('keeps at least one admin', async () => {
    const admin = await users.create({ username: 'admin', password: 'password123', role: 'admin' });
    await expect(users.update(admin.id, { role: 'user' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(users.remove(admin.id)).rejects.toBeInstanceOf(BadRequestException);

    // With a second admin the first can step down, which leaves the second as the only one.
    const second = await users.create({
      username: 'second',
      password: 'password123',
      role: 'admin',
    });
    await expect(users.update(admin.id, { role: 'user' })).resolves.toMatchObject({ role: 'user' });
    await expect(users.remove(second.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("deletes a user's jobs with the user", async () => {
    const user = await users.create({ username: 'temp', password: 'password123' });
    await database.db.insert(jobs).values({ title: 'Job', company: 'Acme', userId: user.id });

    await users.remove(user.id);
    await expect(database.db.select().from(jobs)).resolves.toEqual([]);
  });

  it('changes passwords only with the current password', async () => {
    const user = await users.create({ username: 'alice', password: 'password123' });
    await expect(users.changePassword(user.id, 'nope', 'new-password')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await users.changePassword(user.id, 'password123', 'new-password');
    await expect(users.authenticate('alice', 'new-password')).resolves.not.toBeNull();
  });

  it('stores a profile per user', async () => {
    const alice = await users.create({ username: 'alice', password: 'password123' });
    const bob = await users.create({ username: 'bob', password: 'password123' });
    await users.updateProfile(alice.id, { headline: 'Designer' });

    await expect(users.getProfile(alice.id)).resolves.toMatchObject({
      headline: 'Designer',
      name: '',
    });
    await expect(users.getProfile(bob.id)).resolves.toMatchObject({ headline: '' });
  });

  it('stores a dashboard layout per user and keeps it complete', async () => {
    const alice = await users.create({ username: 'alice', password: 'password123' });

    await expect(users.getPreferences(alice.id)).resolves.toEqual({
      dashboard: { order: [...DASHBOARD_CARDS], hidden: [] },
    });

    const saved = await users.updatePreferences(alice.id, {
      dashboard: { order: ['pipeline', 'active', 'active'], hidden: ['weekly'] },
    });
    // Unknown and duplicate cards are dropped; cards left out are appended so none go missing.
    expect(saved.dashboard.order.slice(0, 2)).toEqual(['pipeline', 'active']);
    expect([...saved.dashboard.order].sort()).toEqual([...DASHBOARD_CARDS].sort());
    expect(saved.dashboard.hidden).toEqual(['weekly']);
    await expect(users.getPreferences(alice.id)).resolves.toEqual(saved);
  });
});
