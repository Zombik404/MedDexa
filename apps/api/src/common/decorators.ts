import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export interface RequestUser {
  id: string;
  email: string;
  role: Role;
}

export const IS_AUTH_REQUIRED = 'meddexa:auth-required';
export const ROLES_KEY = 'meddexa:roles';

/** Requires a valid access token. Routes are public by default (guest access). */
export const RequireAuth = () => SetMetadata(IS_AUTH_REQUIRED, true);

/** Restricts a route to the given roles (implies authentication). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser | null => {
  return ctx.switchToHttp().getRequest().user ?? null;
});

export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null => {
  const req = ctx.switchToHttp().getRequest();
  return req.ip ?? null;
});
