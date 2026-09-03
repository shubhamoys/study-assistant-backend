import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Category } from '../store/entities/category.entity';
import { Deck } from '../store/entities/deck.entity';
import { Flashcard } from '../study/entities/flashcard.entity';
import { ReviewHistory } from '../study/entities/review-history.entity';
import { Review } from '../reviews/entities/review.entity';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

// Every repository here belongs to another module — same cross-module
// injection pattern StoreModule/LibraryModule already use (see their own
// comments). Admin has no entities of its own; it only ever reads across
// the others'.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Category,
      Deck,
      Flashcard,
      Review,
      ReviewHistory,
    ]),
  ],
  providers: [AdminService, AdminResolver],
})
export class AdminModule {}
