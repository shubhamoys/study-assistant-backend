import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Category } from './entities/category.entity';
import { Deck } from './entities/deck.entity';
import { StoreResolver } from './store.resolver';
import { StoreService } from './store.service';

@Module({
  // Flashcard belongs to the `study` module (session/FSRS logic needs it
  // there), but authoring a deck's cards is squarely a store/deck-authoring
  // concern — same cross-module repo injection already used elsewhere
  // (LibraryService/ReviewsService both inject Deck's repository).
  imports: [TypeOrmModule.forFeature([Category, Deck, Flashcard])],
  providers: [StoreService, StoreResolver],
  exports: [StoreService],
})
export class StoreModule {}
