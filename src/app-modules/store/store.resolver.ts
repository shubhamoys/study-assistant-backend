import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { CategoryType } from './dto/category.type';
import { DecksArgs } from './dto/decks.args';
import { DeckType } from './dto/deck.type';
import { Category } from './entities/category.entity';
import { Deck } from './entities/deck.entity';
import { StoreService } from './store.service';

@Resolver()
export class StoreResolver {
  constructor(private readonly storeService: StoreService) {}

  @Query(() => [CategoryType])
  categories(): Promise<Category[]> {
    return this.storeService.findAllCategories();
  }

  @Query(() => [DeckType])
  decks(@Args() args: DecksArgs): Promise<Deck[]> {
    return this.storeService.findDecks(args);
  }

  @Query(() => DeckType)
  deck(@Args('id', { type: () => ID }) id: string): Promise<Deck> {
    return this.storeService.findDeckById(id);
  }
}
