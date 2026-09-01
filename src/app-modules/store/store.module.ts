import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Library } from '../library/entities/library.entity';
import { Category } from './entities/category.entity';
import { Deck } from './entities/deck.entity';
import { StoreResolver } from './store.resolver';
import { StoreService } from './store.service';

@Module({
  // Flashcard/Library belong to other modules (study/library, respectively),
  // but StoreService needs both directly: Flashcard for deck-authoring, and
  // Library to auto-enroll a newly created deck in its own author's library
  // (see createDeck). Same cross-module repo injection already used
  // elsewhere (LibraryService/ReviewsService both inject Deck's repository).
  imports: [TypeOrmModule.forFeature([Category, Deck, Flashcard, Library])],
  providers: [StoreService, StoreResolver],
  exports: [StoreService],
})
export class StoreModule {}
