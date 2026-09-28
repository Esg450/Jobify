import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ONLY, IS_PUBLIC, type AuthenticatedRequest } from './decorators.js';
import { readSessionCookie } from './session-cookie.js';
import { SessionsService } from './sessions.service.js';

/** Applied globally: every route requires a session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionCookie(request);
    const user = await this.sessions.findUser(token);
    if (!user || !token) throw new UnauthorizedException('Sign in required');

    if (this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY, targets) && user.role !== 'admin') {
      throw new ForbiddenException('Only admins can do that');
    }

    request.user = user;
    request.sessionToken = token;
    return true;
  }
}
