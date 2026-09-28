import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put, Req } from '@nestjs/common';
import { CurrentUser, type AuthenticatedRequest } from '../auth/decorators.js';
import { SessionsService } from '../auth/sessions.service.js';
import { ProfileDto } from './profile.dto.js';
import { ChangePasswordDto, UpdateAccountDto } from './users.dto.js';
import { UsersService, type PublicUser } from './users.service.js';

/** The signed-in user's own account. */
@Controller('account')
export class AccountController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}

  @Get()
  get(@CurrentUser() user: PublicUser) {
    return user;
  }

  @Patch()
  update(@CurrentUser() user: PublicUser, @Body() dto: UpdateAccountDto) {
    return this.users.update(user.id, { displayName: dto.displayName });
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@Req() request: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    await this.users.changePassword(request.user.id, dto.currentPassword, dto.password);
    // Keep this browser signed in, but sign out everywhere else.
    await this.sessions.revokeAll(request.user.id, request.sessionToken);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: PublicUser) {
    return this.users.getProfile(user.id);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: PublicUser, @Body() dto: ProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }
}
