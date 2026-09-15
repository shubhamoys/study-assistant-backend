import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Applied globally (see auth.module.ts) — every resolver requires a valid
 * Bearer JWT unless annotated with @Public(). Overrides getRequest() because
 * passport-jwt's default AuthGuard assumes an HTTP execution context, which
 * is empty for GraphQL requests (same issue as GqlThrottlerGuard).
 *
 * Also handles plain REST controllers (e.g. the avatar upload endpoint) —
 * `context.getType()` reads 'http' for those (set by the underlying Express
 * adapter before any GraphQL wrapping happens), so this branches rather than
 * assuming every request is a GraphQL one.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest<Record<string, unknown>>();
    }
    return GqlExecutionContext.create(context).getContext<{ req: unknown }>()
      .req;
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
