import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/configuration.js';
import { SettingsService } from '../settings/settings.service.js';

export const SESSION_COOKIE = 'jobify_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Optional single-user password protection, enabled by setting JOBIFY_PASSWORD.
 * Sessions are stateless signed tokens; changing the password invalidates them.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private signingKey?: Buffer;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly settings: SettingsService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.password);
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;
    let secret = await this.settings.get<string>('sessionSecret');
    if (!secret) {
      secret = randomBytes(32).toString('hex');
      await this.settings.set('sessionSecret', secret);
    }
    this.signingKey = createHash('sha256').update(`${secret}:${this.config.password}`).digest();
  }

  verifyPassword(password: string): boolean {
    return AuthService.safeEqual(
      AuthService.hash(password),
      AuthService.hash(this.config.password ?? ''),
    );
  }

  createSession(now = Date.now()): string {
    const expiresAt = String(now + SESSION_TTL_MS);
    return `${expiresAt}.${this.sign(expiresAt)}`;
  }

  isValidSession(token: string | undefined, now = Date.now()): boolean {
    if (!this.enabled) return true;
    const [expiresAt, signature] = token?.split('.') ?? [];
    if (!expiresAt || !signature || Number(expiresAt) < now) return false;
    return AuthService.safeEqual(Buffer.from(signature), Buffer.from(this.sign(expiresAt)));
  }

  private sign(value: string): string {
    if (!this.signingKey) throw new Error('Authentication is not initialized');
    return createHmac('sha256', this.signingKey).update(value).digest('base64url');
  }

  private static hash(value: string): Buffer {
    return createHash('sha256').update(value).digest();
  }

  private static safeEqual(a: Buffer, b: Buffer): boolean {
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
