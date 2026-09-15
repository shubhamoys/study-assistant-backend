import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * Lightweight progress summary for a deck's study queue — counts only, no
 * card content, so a UI can show "12 due today" without paying for full
 * flashcard payloads it won't render until `nextCard` is actually called.
 */
@ObjectType('StudyQueue')
export class StudyQueueType {
  @Field(() => ID)
  deckId!: string;

  /** Cards previously studied whose `dueAt` has arrived. */
  @Field(() => Int)
  dueCount!: number;

  /** Cards never studied yet (no `CardProgress` row). */
  @Field(() => Int)
  newCount!: number;

  @Field(() => Int)
  totalCount!: number;
}
