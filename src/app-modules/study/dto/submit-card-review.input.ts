import { Field, ID, InputType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Rating } from '../../../database/enums';

registerEnumType(Rating, { name: 'Rating' });

@InputType()
export class SubmitCardReviewInput {
  @Field(() => ID)
  @IsUUID()
  deckId!: string;

  @Field(() => ID)
  @IsUUID()
  cardId!: string;

  @Field(() => Rating)
  @IsEnum(Rating)
  rating!: Rating;

  /**
   * Omit on the first review of a session — the resolver creates a new
   * `StudySession` and returns its id in the response; pass that id on every
   * subsequent call so all reviews in one sitting share the same session.
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
