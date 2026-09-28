import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountController } from '../users/account.controller.js';
import { UsersController } from '../users/users.controller.js';
import { UsersService } from '../users/users.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionsService } from './sessions.service.js';

/** Accounts, sessions and the global guard that protects every other route. */
@Global()
@Module({
  // Applied to sign-in, sign-up and setup only, to slow down password guessing.
  imports: [ThrottlerModule.forRoot([{ ttl: 15 * 60_000, limit: 10 }])],
  controllers: [AuthController, AccountController, UsersController],
  providers: [
    AuthService,
    SessionsService,
    UsersService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [UsersService, SessionsService],
})
export class AuthModule {}
