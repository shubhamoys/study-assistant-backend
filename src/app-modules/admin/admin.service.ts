import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Category } from '../store/entities/category.entity';
import { Deck } from '../store/entities/deck.entity';
import { Flashcard } from '../study/entities/flashcard.entity';
import { ReviewHistory } from '../study/entities/review-history.entity';
import { Review } from '../reviews/entities/review.entity';
import {
  AdminAnalytics,
  AdminCategoryCount,
  AdminDailyCount,
  AdminTopDeck,
} from './dto/analytics.type';
import { AdminDashboardStats } from './dto/dashboard-stats.type';

const NEW_USERS_WINDOW_DAYS = 7;
const ANALYTICS_WINDOW_DAYS = 30;
const TOP_DECKS_LIMIT = 5;

/** See getDailyCounts's comment on why this isn't `.toISOString().slice(0, 10)`. */
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Deck) private readonly deckRepository: Repository<Deck>,
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(ReviewHistory)
    private readonly reviewHistoryRepository: Repository<ReviewHistory>,
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

  /**
   * Plain rankings/tables, not charts — the user's own call when this
   * checkpoint's scope was reviewed (graphs are a post-MVP follow-up). Every
   * daily-count series only includes days with at least one event; no
   * zero-filled gaps, since a sparse table reads fine and a real chart is
   * explicitly not what this renders as.
   */
  async getAnalytics(): Promise<AdminAnalytics> {
    const windowStart = new Date(
      Date.now() - ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const [
      decksPerCategory,
      topDecksByDownloads,
      topDecksByRating,
      signupsByDay,
      reviewsByDay,
    ] = await Promise.all([
      this.getDecksPerCategory(),
      this.getTopDecks('downloadsCount'),
      this.getTopDecks('ratingAverage'),
      this.getDailyCounts(this.userRepository, 'user', windowStart),
      this.getDailyCounts(
        this.reviewHistoryRepository,
        'reviewHistory',
        windowStart,
      ),
    ]);

    return {
      decksPerCategory,
      topDecksByDownloads,
      topDecksByRating,
      signupsByDay,
      reviewsByDay,
    };
  }

  private async getDecksPerCategory(): Promise<AdminCategoryCount[]> {
    const raw = await this.deckRepository
      .createQueryBuilder('deck')
      .leftJoin('deck.category', 'category')
      .select('category.name', 'categoryName')
      .addSelect('COUNT(deck.id)', 'deckCount')
      .where('deck.isPublic = true')
      .groupBy('category.name')
      .orderBy('"deckCount"', 'DESC')
      .getRawMany<{ categoryName: string | null; deckCount: string }>();

    return raw.map((row) => ({
      categoryName: row.categoryName ?? 'Uncategorized',
      deckCount: Number(row.deckCount),
    }));
  }

  private async getTopDecks(
    orderBy: 'downloadsCount' | 'ratingAverage',
  ): Promise<AdminTopDeck[]> {
    const decks = await this.deckRepository.find({
      where: { isPublic: true },
      order: { [orderBy]: 'DESC' },
      take: TOP_DECKS_LIMIT,
    });
    return decks.map((deck) => ({
      id: deck.id,
      title: deck.title,
      downloadsCount: deck.downloadsCount,
      ratingAverage: deck.ratingAverage,
      ratingCount: deck.ratingCount,
    }));
  }

  private async getDailyCounts(
    repository: Repository<User | ReviewHistory>,
    alias: string,
    windowStart: Date,
  ): Promise<AdminDailyCount[]> {
    // `AT TIME ZONE 'UTC'` matters — plain DATE(...) buckets by the DB
    // session's timezone, which doesn't have to be UTC (it wasn't in dev,
    // and silently shifted a same-day signup into "yesterday"/"tomorrow"
    // depending on the hour — caught by this method's own e2e test, not
    // assumed). Bucketing in UTC matches `new Date().toISOString()` on the
    // frontend/test side, so "today" means the same thing everywhere.
    const raw = await repository
      .createQueryBuilder(alias)
      .select(`DATE(${alias}.createdAt AT TIME ZONE 'UTC')`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where(`${alias}.createdAt >= :windowStart`, { windowStart })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: Date | string; count: string }>();

    // pg's node-postgres driver parses a `date`-typed column using the
    // *local* timezone's midnight (`new Date(year, month, day)`), not UTC —
    // so `.toISOString()` on it is wrong: in any positive UTC offset (e.g.
    // IST, +5:30, this dev environment) it silently shifts every date back
    // by one day. Reading it back with local getters (getFullYear/
    // getMonth/getDate) reverses the same local construction correctly.
    // Caught by this method's own e2e test asserting "today" appears in the
    // series, not assumed — a bare DATE() string (the non-Date branch) needs
    // no such correction, it's already "YYYY-MM-DD".
    return raw.map((row) => ({
      date: row.date instanceof Date ? formatLocalDate(row.date) : row.date,
      count: Number(row.count),
    }));
  }
}
