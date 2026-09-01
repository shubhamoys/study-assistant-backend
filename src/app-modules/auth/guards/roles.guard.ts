import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../../../database/enums';
import { User } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Registered as a second global APP_GUARD in auth.module.ts, right after
 * JwtAuthGuard — order matters, this reads `request.user`, which
 * JwtAuthGuard is what populates. A resolver with no @Roles() metadata is
 * untouched by this guard (returns true immediately): RBAC is opt-in per
 * resolver, not a second global auth wall.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request =
      context.getType() === 'http'
        ? context.switchToHttp().getRequest<{ user: User }>()
        : GqlExecutionContext.create(context).getContext<{
            req: { user: User };
          }>().req;

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return true;
  }
}
