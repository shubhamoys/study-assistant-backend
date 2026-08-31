import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * Only ever returned from `deckFlashcards` (owner-only, full front/back
 * content for editing) — studying someone else's deck goes through
 * `nextCard` one at a time instead, which never exposes the full set.
 */
@ObjectType('Flashcard')
export class FlashcardType {
  @Field(() => ID)
  id!: string;

  @Field()
  front!: string;

  @Field()
  back!: string;

  @Field(() => Int)
  orderIndex!: number;

  @Field()
  createdAt!: Date;
}
