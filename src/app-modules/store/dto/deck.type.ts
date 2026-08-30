import {
  Field,
  Float,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { Difficulty } from '../../../database/enums';
import { CategoryType } from './category.type';

registerEnumType(Difficulty, { name: 'Difficulty' });

/**
 * Public GraphQL shape of a deck for Store/Library browsing. Deliberately
 * excludes `authorId`/`author` (no author-facing UI until Phase 2 custom
 * decks) and `flashcards` (card content is only exposed once study starts,
 * checkpoint 3) — `cardCount` is enough for browsing.
 */
@ObjectType('Deck')
export class DeckType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String, { nullable: true })
  coverUrl!: string | null;

  @Field(() => Difficulty)
  difficulty!: Difficulty;

  @Field()
  isFree!: boolean;

  @Field(() => Int)
  price!: number;

  @Field(() => CategoryType)
  category!: CategoryType;

  @Field()
  authorDisplayName!: string;

  @Field(() => Int)
  cardCount!: number;

  @Field(() => Int)
  estimatedStudyMinutes!: number;

  @Field(() => Int)
  downloadsCount!: number;

  @Field(() => Float)
  ratingAverage!: number;

  @Field(() => Int)
  ratingCount!: number;

  @Field()
  createdAt!: Date;
}
