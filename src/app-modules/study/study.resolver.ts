import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CardReviewResultType } from './dto/card-review-result.type';
import { NextCardType } from './dto/next-card.type';
import { StudyQueueType } from './dto/study-queue.type';
import { SubmitCardReviewInput } from './dto/submit-card-review.input';
import { StudyService } from './study.service';

@Resolver()
export class StudyResolver {
  constructor(private readonly studyService: StudyService) {}

  @Query(() => StudyQueueType)
  studyQueue(
    @CurrentUser() user: User,
    @Args('deckId', { type: () => ID }) deckId: string,
  ): Promise<StudyQueueType> {
    return this.studyService.getStudyQueue(user.id, deckId);
  }

  @Query(() => NextCardType, { nullable: true })
  nextCard(
    @CurrentUser() user: User,
    @Args('deckId', { type: () => ID }) deckId: string,
  ): Promise<NextCardType | null> {
    return this.studyService.getNextCard(user.id, deckId);
  }

  @Mutation(() => CardReviewResultType)
  submitCardReview(
    @CurrentUser() user: User,
    @Args('input') input: SubmitCardReviewInput,
  ): Promise<CardReviewResultType> {
    return this.studyService.submitCardReview(user.id, input);
  }

  @Mutation(() => Boolean)
  completeStudySession(
    @CurrentUser() user: User,
    @Args('sessionId', { type: () => ID }) sessionId: string,
  ): Promise<boolean> {
    return this.studyService.completeStudySession(user.id, sessionId);
  }
}
