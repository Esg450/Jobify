import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PublicUser } from '../users/users.service.js';

export const IS_PUBLIC = 'isPublic';
export const ADMIN_ONLY = 'adminOnly';

/** Marks a route as reachable without signing in. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restricts a route to admins. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY, true);

export type AuthenticatedRequest = Request & { user: PublicUser; sessionToken: string };

/** The signed-in user, as resolved by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
