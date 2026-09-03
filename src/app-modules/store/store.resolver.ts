import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/enums';
import { User } from '../users/entities/user.entity';
import { Flashcard } from '../study/entities/flashcard.entity';
import { AdminCreateDeckInput } from './dto/admin-create-deck.input';
import { AdminUpdateDeckInput } from './dto/admin-update-deck.input';
import { CategoryType } from './dto/category.type';
import { CreateCategoryInput } from './dto/create-category.input';
import { CreateDeckInput } from './dto/create-deck.input';
import { CreateFlashcardInput } from './dto/create-flashcard.input';
import { DecksArgs } from './dto/decks.args';
import { DeckType } from './dto/deck.type';
import { FlashcardType } from './dto/flashcard.type';
import { ImportDeckInput } from './dto/import-deck.input';
import { UpdateCategoryInput } from './dto/update-category.input';
import { UpdateDeckInput } from './dto/update-deck.input';
import { UpdateFlashcardInput } from './dto/update-flashcard.input';
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

  @Mutation(() => CategoryType)
  @Roles(UserRole.ADMIN)
  createCategory(@Args('input') input: CreateCategoryInput): Promise<Category> {
    return this.storeService.createCategory(input);
  }

  @Mutation(() => CategoryType)
  @Roles(UserRole.ADMIN)
  updateCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCategoryInput,
  ): Promise<Category> {
    return this.storeService.updateCategory(id, input);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.ADMIN)
  deleteCategory(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.storeService.deleteCategory(id);
  }

  @Query(() => [DeckType])
  decks(@Args() args: DecksArgs): Promise<Deck[]> {
    return this.storeService.findDecks(args);
  }

  @Query(() => DeckType)
  deck(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<Deck> {
    return this.storeService.findDeckById(id, user.id);
  }

  @Query(() => [DeckType])
  myDecks(@CurrentUser() user: User): Promise<Deck[]> {
    return this.storeService.findMyDecks(user.id);
  }

  @Mutation(() => DeckType)
  createDeck(
    @Args('input') input: CreateDeckInput,
    @CurrentUser() user: User,
  ): Promise<Deck> {
    return this.storeService.createDeck(user.id, input);
  }

  @Mutation(() => DeckType)
  importDeck(
    @Args('input') input: ImportDeckInput,
    @CurrentUser() user: User,
  ): Promise<Deck> {
    return this.storeService.importDeck(user.id, input);
  }

  @Mutation(() => DeckType)
  updateDeck(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateDeckInput,
    @CurrentUser() user: User,
  ): Promise<Deck> {
    return this.storeService.updateDeck(user.id, id, input);
  }

  @Mutation(() => Boolean)
  deleteDeck(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.storeService.deleteDeck(user.id, id);
  }

  @Query(() => [FlashcardType])
  deckFlashcards(
    @Args('deckId', { type: () => ID }) deckId: string,
    @CurrentUser() user: User,
  ): Promise<Flashcard[]> {
    return this.storeService.findDeckFlashcards(user.id, deckId);
  }

  @Mutation(() => FlashcardType)
  createFlashcard(
    @Args('input') input: CreateFlashcardInput,
    @CurrentUser() user: User,
  ): Promise<Flashcard> {
    return this.storeService.createFlashcard(user.id, input);
  }

  @Mutation(() => FlashcardType)
  updateFlashcard(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateFlashcardInput,
    @CurrentUser() user: User,
  ): Promise<Flashcard> {
    return this.storeService.updateFlashcard(user.id, id, input);
  }

  @Mutation(() => Boolean)
  deleteFlashcard(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.storeService.deleteFlashcard(user.id, id);
  }

  // ---- Admin deck management (Phase 3 checkpoint 3) ----

  @Query(() => [DeckType])
  @Roles(UserRole.ADMIN)
  adminDecks(@Args() args: DecksArgs): Promise<Deck[]> {
    // Same underlying query as the public `decks` browse — every public
    // deck is exactly what admin deck management manages. A distinct
    // resolver name/gate rather than reusing `decks` directly keeps the
    // admin app's queries self-descriptive and independently cacheable.
    return this.storeService.findDecks(args);
  }

  @Mutation(() => DeckType)
  @Roles(UserRole.ADMIN)
  adminCreateDeck(
    @Args('input') input: AdminCreateDeckInput,
    @CurrentUser() user: User,
  ): Promise<Deck> {
    return this.storeService.adminCreateDeck(user.id, input);
  }

  @Mutation(() => DeckType)
  @Roles(UserRole.ADMIN)
  adminUpdateDeck(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: AdminUpdateDeckInput,
  ): Promise<Deck> {
    return this.storeService.adminUpdateDeck(id, input);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.ADMIN)
  adminDeleteDeck(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.storeService.adminDeleteDeck(id);
  }

  @Query(() => [FlashcardType])
  @Roles(UserRole.ADMIN)
  adminDeckFlashcards(
    @Args('deckId', { type: () => ID }) deckId: string,
  ): Promise<Flashcard[]> {
    return this.storeService.adminDeckFlashcards(deckId);
  }

  @Mutation(() => FlashcardType)
  @Roles(UserRole.ADMIN)
  adminCreateFlashcard(
    @Args('input') input: CreateFlashcardInput,
  ): Promise<Flashcard> {
    return this.storeService.adminCreateFlashcard(input);
  }

  @Mutation(() => FlashcardType)
  @Roles(UserRole.ADMIN)
  adminUpdateFlashcard(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateFlashcardInput,
  ): Promise<Flashcard> {
    return this.storeService.adminUpdateFlashcard(id, input);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.ADMIN)
  adminDeleteFlashcard(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.storeService.adminDeleteFlashcard(id);
  }
}
