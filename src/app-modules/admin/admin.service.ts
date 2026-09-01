import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Deck } from '../store/entities/deck.entity';
import { Flashcard } from '../study/entities/flashcard.entity';
import { Review } from '../reviews/entities/review.entity';
import { AdminDashboardStats } from './dto/dashboard-stats.type';

const NEW_USERS_WINDOW_DAYS = 7;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Deck) private readonly deckRepository: Repository<Deck>,
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const sevenDaysAgo = new Date(
      Date.now() - NEW_USERS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    // Independent counts — Promise.all rather than sequential awaits, same
    // "no waterfall for unrelated queries" reasoning as everywhere else in
    // this codebase that fires more than one query per request.
    const [
      totalUsers,
      totalDecks,
      totalPublicDecks,
      totalFlashcards,
      totalReviews,
      newUsersLast7Days,
    ] = await Promise.all([
      this.userRepository.count(),
      this.deckRepository.count(),
      this.deckRepository.count({ where: { isPublic: true } }),
      this.flashcardRepository.count(),
      this.reviewRepository.count(),
      this.userRepository.count({
        where: { createdAt: MoreThanOrEqual(sevenDaysAgo) },
      }),
    ]);

    return {
      totalUsers,
      totalDecks,
      totalPublicDecks,
      totalFlashcards,
      totalReviews,
      newUsersLast7Days,
    };
  }
}
