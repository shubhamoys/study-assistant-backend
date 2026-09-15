import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

/**
 * The authenticated user, attached to the request by JwtStrategy.validate().
 * Works in both GraphQL resolvers and plain REST controllers (see the same
 * getType() branch in JwtAuthGuard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest<{ user: User }>().user;
    }
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<{ req: { user: User } }>().req.user;
  },
);
