import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/configuration.js';
import type { SettingsService } from '../settings/settings.service.js';
import { AuthService, SESSION_TTL_MS } from './auth.service.js';

function inMemorySettings(): SettingsService {
  const store = new Map<string, unknown>();
  return {
    get: (key: string) => Promise.resolve(store.get(key)),
    set: (key: string, value: unknown) => Promise.resolve(void store.set(key, value)),
  } as unknown as SettingsService;
}

describe('AuthService', () => {
  let auth: AuthService;
  const settings = inMemorySettings();

  beforeEach(async () => {
    auth = new AuthService(loadConfig({ JOBIFY_PASSWORD: 'hunter2' }), settings);
    await auth.onModuleInit();
  });

  it('checks the password', () => {
    expect(auth.verifyPassword('hunter2')).toBe(true);
    expect(auth.verifyPassword('hunter3')).toBe(false);
  });

  it('accepts its own sessions until they expire', () => {
    const now = Date.now();
    const token = auth.createSession(now);
    expect(auth.isValidSession(token, now)).toBe(true);
    expect(auth.isValidSession(token, now + SESSION_TTL_MS + 1)).toBe(false);
  });

  it('rejects tampered or missing tokens', () => {
    const [expiresAt, signature] = auth.createSession().split('.');
    expect(auth.isValidSession(`${Number(expiresAt) + 1000}.${signature}`)).toBe(false);
    expect(auth.isValidSession(undefined)).toBe(false);
    expect(auth.isValidSession('garbage')).toBe(false);
  });

  it('invalidates sessions when the password changes', async () => {
    const token = auth.createSession();
    const changed = new AuthService(loadConfig({ JOBIFY_PASSWORD: 'new-password' }), settings);
    await changed.onModuleInit();
    expect(changed.isValidSession(token)).toBe(false);
  });

  it('allows everything when no password is set', () => {
    const open = new AuthService(loadConfig({}), settings);
    expect(open.enabled).toBe(false);
    expect(open.isValidSession(undefined)).toBe(true);
  });
});
