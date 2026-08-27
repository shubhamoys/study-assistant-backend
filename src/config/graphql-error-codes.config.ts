/**
 * Extends @nestjs/apollo's built-in HTTP-status -> GraphQL `extensions.code`
 * mapping, which only covers 400/401/403/422 (hardcoded inside
 * @nestjs/apollo's driver — not configurable there). Any other HttpException
 * status (e.g. ConflictException -> 409) would otherwise fall through to
 * `INTERNAL_SERVER_ERROR` even though the real status is preserved on
 * `extensions.status`. Consumed by app.module.ts's GraphQLModule formatError.
 *
 * Not a `registerAs()` entry like the rest of src/config — this isn't
 * env-derived, so it isn't part of the ConfigModule `load` array; import it
 * directly where needed.
 */
export const HTTP_STATUS_TO_GRAPHQL_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'BAD_USER_INPUT',
  429: 'TOO_MANY_REQUESTS',
};
