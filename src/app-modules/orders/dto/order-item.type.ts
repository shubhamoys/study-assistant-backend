import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { DeckType } from '../../store/dto/deck.type';

@ObjectType('OrderItem')
export class OrderItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => DeckType)
  deck!: DeckType;

  /** Price at purchase time (paise) — see OrderItem entity's doc comment. */
  @Field(() => Int)
  price!: number;

  @Field()
  createdAt!: Date;
}
