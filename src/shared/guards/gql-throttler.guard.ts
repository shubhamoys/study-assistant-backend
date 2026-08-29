import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * @nestjs/throttler reads the request off the HTTP execution context by
 * default, which is empty for GraphQL requests. Pull it out of the GraphQL
 * context (set in AppModule's GraphQLModule `context` factory) instead.
 *
 * Also handles plain REST controllers (e.g. the avatar upload endpoint) —
 * those already have a real HTTP execution context, so use it directly
 * rather than routing through GqlExecutionContext (which expects GraphQL's
 * resolver argument shape and returns nothing useful for a REST handler).
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType() === 'http') {
      const http = context.switchToHttp();
      return {
        req: http.getRequest<Record<string, unknown>>(),
        res: http.getResponse<Record<string, unknown>>(),
      };
    }
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req: Record<string, unknown>;
      res: Record<string, unknown>;
    }>();
    return { req: gqlContext.req, res: gqlContext.res };
  }
}
