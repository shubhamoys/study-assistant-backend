import { registerEnumType } from '@nestjs/graphql';

/**
 * GraphQL-only enum — no DB column backs this (unlike `Difficulty`/`Rating`
 * in `database/enums.ts`, which are real Postgres enum columns), so it's
 * declared and registered here beside the args that use it, not centrally.
 */
export enum DeckSortOrder {
  NEWEST = 'NEWEST',
  RATING = 'RATING',
  DOWNLOADS = 'DOWNLOADS',
  TITLE = 'TITLE',
}

registerEnumType(DeckSortOrder, { name: 'DeckSortOrder' });
