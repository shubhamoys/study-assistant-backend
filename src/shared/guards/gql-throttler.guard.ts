import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * @nestjs/throttler reads the request off the HTTP execution context by
 * default, which is empty for GraphQL requests. Pull it out of the GraphQL
 * context (set in AppModule's GraphQLModule `context` factory) instead.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req: Record<string, unknown>;
      res: Record<string, unknown>;
    }>();
    return { req: gqlContext.req, res: gqlContext.res };
  }
}
