import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deck } from '../store/entities/deck.entity';
import { CreateReviewInput } from './dto/create-review.input';
import { UpdateReviewInput } from './dto/update-review.input';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Deck) private readonly deckRepository: Repository<Deck>,
  ) {}

  async findByDeckId(deckId: string): Promise<Review[]> {
    const reviews = await this.reviewRepository.find({
      where: { deckId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    return reviews.map((review) => this.withAuthor(review));
  }

  async create(userId: string, input: CreateReviewInput): Promise<Review> {
    const existing = await this.reviewRepository.findOneBy({
      userId,
      deckId: input.deckId,
    });
    if (existing) {
      throw new ConflictException("You've already reviewed this deck");
    }

    const saved = await this.reviewRepository.save(
      this.reviewRepository.create({
        userId,
        deckId: input.deckId,
        rating: input.rating,
        comment: input.comment ?? null,
      }),
    );
    await this.recomputeDeckRating(input.deckId);
    return this.findByIdWithAuthor(saved.id);
  }

  async update(
    userId: string,
    reviewId: string,
    input: UpdateReviewInput,
  ): Promise<Review> {
    const review = await this.findOwnedOrFail(userId, reviewId);
    if (input.rating !== undefined) review.rating = input.rating;
    if (input.comment !== undefined) review.comment = input.comment;
    await this.reviewRepository.save(review);
    await this.recomputeDeckRating(review.deckId);
    return this.findByIdWithAuthor(reviewId);
  }

  async remove(userId: string, reviewId: string): Promise<boolean> {
    const review = await this.findOwnedOrFail(userId, reviewId);
    await this.reviewRepository.delete({ id: reviewId });
    await this.recomputeDeckRating(review.deckId);
    return true;
  }

  /**
   * `{ id, userId }` both in the lookup deliberately merges "doesn't exist"
   * and "exists but isn't yours" into one `NotFoundException` — same
   * don't-leak-details reasoning as `forgotPassword` never revealing whether
   * an email is registered.
   */
  private async findOwnedOrFail(
    userId: string,
    reviewId: string,
  ): Promise<Review> {
    const review = await this.reviewRepository.findOneBy({
      id: reviewId,
      userId,
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  private async findByIdWithAuthor(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOneOrFail({
      where: { id },
      relations: { user: true },
    });
    return this.withAuthor(review);
  }

  private withAuthor(review: Review): Review {
    review.authorDisplayName = review.user?.displayName ?? 'Unknown';
    review.authorAvatarUrl = review.user?.avatarUrl ?? null;
    return review;
  }

  /** Recomputed from scratch rather than incrementally adjusted — simplest correct approach at this data scale, and self-healing if it's ever out of sync. */
  private async recomputeDeckRating(deckId: string): Promise<void> {
    const raw = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('review.deckId = :deckId', { deckId })
      .getRawOne<{ average: string | null; count: string }>();

    await this.deckRepository.update(deckId, {
      ratingAverage: raw?.average ? Number(raw.average) : 0,
      ratingCount: Number(raw?.count ?? 0),
    });
  }
}
