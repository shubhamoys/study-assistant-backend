import {
  Field,
  Float,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { FSRSState } from '../../../database/enums';

registerEnumType(FSRSState, { name: 'FSRSState' });

@ObjectType('CardReviewResult')
export class CardReviewResultType {
  /** Pass this back as `sessionId` on subsequent `submitCardReview` calls and into `completeStudySession`. */
  @Field(() => ID)
  sessionId!: string;

  @Field(() => ID)
  cardId!: string;

  @Field(() => FSRSState)
  state!: FSRSState;

  @Field()
  dueAt!: Date;

  @Field(() => Float)
  stability!: number;

  @Field(() => Float)
  difficulty!: number;
}
