import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('AdminCategoryCount')
export class AdminCategoryCount {
  @Field()
  categoryName!: string;

  @Field(() => Int)
  deckCount!: number;
}

/** Same shape for both rankings below — a deck already carries both fields, only the sort order differs. */
@ObjectType('AdminTopDeck')
export class AdminTopDeck {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => Int)
  downloadsCount!: number;

  @Field(() => Float)
  ratingAverage!: number;

  @Field(() => Int)
  ratingCount!: number;
}

/** `date` is a plain "YYYY-MM-DD" string — only days with at least one event are included (no zero-filled gaps), since this renders as a table, not a chart (see the Phase 3 checkpoint-3 decision-log entry). */
@ObjectType('AdminDailyCount')
export class AdminDailyCount {
  @Field()
  date!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType('AdminAnalytics')
export class AdminAnalytics {
  @Field(() => [AdminCategoryCount])
  decksPerCategory!: AdminCategoryCount[];

  @Field(() => [AdminTopDeck])
  topDecksByDownloads!: AdminTopDeck[];

  @Field(() => [AdminTopDeck])
  topDecksByRating!: AdminTopDeck[];

  @Field(() => [AdminDailyCount])
  signupsByDay!: AdminDailyCount[];

  @Field(() => [AdminDailyCount])
  reviewsByDay!: AdminDailyCount[];
}
