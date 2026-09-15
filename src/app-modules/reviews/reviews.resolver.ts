import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateReviewInput } from './dto/create-review.input';
import { ReviewType } from './dto/review.type';
import { UpdateReviewInput } from './dto/update-review.input';
import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';

@Resolver()
export class ReviewsResolver {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Query(() => [ReviewType])
  deckReviews(
    @Args('deckId', { type: () => ID }) deckId: string,
  ): Promise<Review[]> {
    return this.reviewsService.findByDeckId(deckId);
  }

  @Mutation(() => ReviewType)
  createReview(
    @Args('input') input: CreateReviewInput,
    @CurrentUser() user: User,
  ): Promise<Review> {
    return this.reviewsService.create(user.id, input);
  }

  @Mutation(() => ReviewType)
  updateReview(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateReviewInput,
    @CurrentUser() user: User,
  ): Promise<Review> {
    return this.reviewsService.update(user.id, id, input);
  }

  @Mutation(() => Boolean)
  deleteReview(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.reviewsService.remove(user.id, id);
  }
}
