import { Field, Int, ObjectType } from '@nestjs/graphql';

/** Checkpoint 1's proof-of-pipeline screen — headline counts only; deeper breakdowns are Analytics (checkpoint 3). */
@ObjectType('AdminDashboardStats')
export class AdminDashboardStats {
  @Field(() => Int)
  totalUsers!: number;

  @Field(() => Int)
  totalDecks!: number;

  @Field(() => Int)
  totalPublicDecks!: number;

  @Field(() => Int)
  totalFlashcards!: number;

  @Field(() => Int)
  totalReviews!: number;

  @Field(() => Int)
  newUsersLast7Days!: number;
}
