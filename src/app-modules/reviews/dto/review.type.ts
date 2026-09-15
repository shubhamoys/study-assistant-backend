import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * Flattens the reviewing user's public info directly onto the review
 * (authorId/authorDisplayName/authorAvatarUrl) rather than nesting a full
 * `UserType` — same reasoning as `DeckType.authorDisplayName`: a review list
 * only ever needs to *display* who wrote it, never the rest of their account.
 */
@ObjectType('Review')
export class ReviewType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  userId!: string;

  @Field()
  authorDisplayName!: string;

  @Field(() => String, { nullable: true })
  authorAvatarUrl!: string | null;

  @Field(() => Int)
  rating!: number;

  @Field(() => String, { nullable: true })
  comment!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
