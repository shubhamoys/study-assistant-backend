import { registerEnumType } from '@nestjs/graphql';

/** GraphQL-only enum — see `DeckSortOrder`'s comment for why this isn't in `database/enums.ts`. */
export enum LibrarySortOrder {
  RECENT = 'RECENT',
  TITLE = 'TITLE',
  LAST_STUDIED = 'LAST_STUDIED',
  RATING = 'RATING',
}

registerEnumType(LibrarySortOrder, { name: 'LibrarySortOrder' });
