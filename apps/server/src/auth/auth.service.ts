import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/configuration.js';
import { SettingsService } from '../settings/settings.service.js';
import { UsersService, type PublicUser } from '../users/users.service.js';
import type { LoginDto, RegisterDto, SetupDto } from './auth.dto.js';
import { SessionsService } from './sessions.service.js';

const REGISTRATION_KEY = 'registrationOpen';
/** Signing secret used by the single-user version's sessions; no longer needed. */
const LEGACY_SESSION_SECRET_KEY = 'sessionSecret';

export interface AuthStatus {
  /** No accounts exist yet; the first visitor creates the admin account. */
  setupRequired: boolean;
  /** Setup must be confirmed with JOBIFY_PASSWORD (instances upgraded from single-user). */
  setupPasswordRequired: boolean;
  registrationOpen: boolean;
  user: PublicUser | null;
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly settings: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.legacyPassword) return;
    const message = (await this.users.count())
      ? 'JOBIFY_PASSWORD is no longer used now that Jobify has user accounts; you can remove it.'
      : 'Open Jobify to create the admin account. JOBIFY_PASSWORD is required to confirm setup.';
    this.logger.warn(message);
  }

  async status(token: string | undefined): Promise<AuthStatus> {
    const setupRequired = (await this.users.count()) === 0;
    return {
      setupRequired,
      setupPasswordRequired: setupRequired && Boolean(this.config.legacyPassword),
      registrationOpen: await this.isRegistrationOpen(),
      user: await this.sessions.findUser(token),
    };
  }

  /** Creates the first admin account and signs them in. Returns a session token. */
  async setup({ setupPassword, ...account }: SetupDto): Promise<string> {
    if ((await this.users.count()) > 0) throw new ConflictException('Jobify is already set up');
    if (this.config.legacyPassword && !safeEqual(setupPassword ?? '', this.config.legacyPassword)) {
      throw new UnauthorizedException('Enter the current JOBIFY_PASSWORD to finish setup');
    }

    const admin = await this.users.createFirstAdmin(account);
    await this.settings.delete(LEGACY_SESSION_SECRET_KEY);
    return this.sessions.create(admin.id);
  }

  async login({ username, password }: LoginDto): Promise<string> {
    const user = await this.users.authenticate(username, password);
    if (!user) throw new UnauthorizedException('Incorrect username or password');
    return this.sessions.create(user.id);
  }

  async register(dto: RegisterDto): Promise<string> {
    if (!(await this.isRegistrationOpen())) {
      throw new ForbiddenException(
        'Sign-up is disabled. Ask an admin to create an account for you.',
      );
    }
    const user = await this.users.create(dto);
    return this.sessions.create(user.id);
  }

  async isRegistrationOpen(): Promise<boolean> {
    return (await this.settings.get<boolean>(REGISTRATION_KEY)) ?? false;
  }

  async setRegistrationOpen(open: boolean): Promise<void> {
    await this.settings.set(REGISTRATION_KEY, open);
  }
}

function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
