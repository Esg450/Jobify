import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/configuration.js';
import { createTestDatabase, type TestDatabase } from '../database/testing.js';
import { HuntsService } from '../hunts/hunts.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { SESSION_TTL_MS, SessionsService } from './sessions.service.js';

const ACCOUNT = { username: 'admin', password: 'password123' };

describe('AuthService', () => {
  let database: TestDatabase;
  let sessions: SessionsService;
  let users: UsersService;

  const createAuth = (env: NodeJS.ProcessEnv = {}) => {
    const settings = new SettingsService(database.db);
    users = new UsersService(database.db, settings, new HuntsService(database.db));
    return new AuthService(loadConfig(env), users, sessions, settings);
  };

  beforeEach(async () => {
    database = await createTestDatabase();
    sessions = new SessionsService(database.db);
  });

  afterEach(() => database.client.close());

  it('requires setup until the first admin exists, then only once', async () => {
    const auth = createAuth();
    await expect(auth.status(undefined)).resolves.toMatchObject({
      setupRequired: true,
      setupPasswordRequired: false,
      user: null,
    });

    const token = await auth.setup(ACCOUNT);
    await expect(auth.status(token)).resolves.toMatchObject({
      setupRequired: false,
      user: { username: 'admin', role: 'admin' },
    });
    await expect(auth.setup({ ...ACCOUNT, username: 'intruder' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('requires JOBIFY_PASSWORD to set up an upgraded instance', async () => {
    const auth = createAuth({ JOBIFY_PASSWORD: 'old-secret' });
    await expect(auth.status(undefined)).resolves.toMatchObject({ setupPasswordRequired: true });
    await expect(auth.setup(ACCOUNT)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.setup({ ...ACCOUNT, setupPassword: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(auth.setup({ ...ACCOUNT, setupPassword: 'old-secret' })).resolves.toEqual(
      expect.any(String),
    );
  });

  it('signs users in with their username and password', async () => {
    const auth = createAuth();
    await auth.setup(ACCOUNT);

    const token = await auth.login({ username: 'ADMIN', password: 'password123' });
    await expect(sessions.findUser(token)).resolves.toMatchObject({ username: 'admin' });
    await expect(auth.login({ username: 'admin', password: 'nope' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('only allows sign-up when an admin has opened registration', async () => {
    const auth = createAuth();
    await auth.setup(ACCOUNT);
    const newcomer = { username: 'newcomer', password: 'password123' };

    await expect(auth.register(newcomer)).rejects.toBeInstanceOf(ForbiddenException);
    await auth.setRegistrationOpen(true);
    const token = await auth.register(newcomer);
    await expect(sessions.findUser(token)).resolves.toMatchObject({
      username: 'newcomer',
      role: 'user',
    });
  });
});

describe('SessionsService', () => {
  let database: TestDatabase;
  let sessions: SessionsService;
  let userId: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    sessions = new SessionsService(database.db);
    userId = await database.createUser('alice');
  });

  afterEach(() => database.client.close());

  it('expires sessions', async () => {
    const now = Date.now();
    const token = await sessions.create(userId, now);
    await expect(sessions.findUser(token, now)).resolves.toMatchObject({ id: userId });
    await expect(sessions.findUser(token, now + SESSION_TTL_MS + 1)).resolves.toBeNull();
    await expect(sessions.findUser('forged-token', now)).resolves.toBeNull();
  });

  it('stores only a hash of the token', async () => {
    const token = await sessions.create(userId);
    const { rows } = await database.client.execute('SELECT id FROM sessions');
    expect(rows[0].id).not.toBe(token);
  });

  it('revokes other sessions while keeping the current one', async () => {
    const current = await sessions.create(userId);
    const other = await sessions.create(userId);
    await sessions.revokeAll(userId, current);

    await expect(sessions.findUser(current)).resolves.not.toBeNull();
    await expect(sessions.findUser(other)).resolves.toBeNull();
  });
});
