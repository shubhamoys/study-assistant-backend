import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LibraryEntryType } from './dto/library-entry.type';
import { Library } from './entities/library.entity';
import { LibraryService } from './library.service';
import { User } from '../users/entities/user.entity';

@Resolver()
export class LibraryResolver {
  constructor(private readonly libraryService: LibraryService) {}

  @Query(() => [LibraryEntryType])
  myLibrary(@CurrentUser() user: User): Promise<Library[]> {
    return this.libraryService.findForUser(user.id);
  }

  @Mutation(() => LibraryEntryType)
  addDeckToLibrary(
    @CurrentUser() user: User,
    @Args('deckId', { type: () => ID }) deckId: string,
  ): Promise<Library> {
    return this.libraryService.addDeck(user.id, deckId);
  }

  @Mutation(() => Boolean)
  removeDeckFromLibrary(
    @CurrentUser() user: User,
    @Args('deckId', { type: () => ID }) deckId: string,
  ): Promise<boolean> {
    return this.libraryService.removeDeck(user.id, deckId);
  }
}
