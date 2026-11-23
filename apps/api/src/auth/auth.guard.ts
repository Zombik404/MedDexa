import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import { IS_AUTH_REQUIRED, ROLES_KEY, type RequestUser } from '../common/decorators';

/**
 * Global guard. Every route is public unless marked with @RequireAuth or @Roles.
 * A valid bearer token is attached to the request on public routes too, so guests and
 * signed-in users share the same endpoints.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const required =
      !!roles || this.reflector.getAllAndOverride<boolean>(IS_AUTH_REQUIRED, [ctx.getHandler(), ctx.getClass()]);

    const header: string | undefined = req.headers?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string; email: string; role: Role }>(token);
        req.user = { id: payload.sub, email: payload.email, role: payload.role } satisfies RequestUser;
      } catch {
        if (required) throw new UnauthorizedException({ message: 'Invalid or expired token', code: 'TOKEN_INVALID' });
      }
    }
    if (required && !req.user) throw new UnauthorizedException({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    if (roles && !roles.includes(req.user.role)) {
      throw new ForbiddenException({ message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }
    return true;
  }
}
