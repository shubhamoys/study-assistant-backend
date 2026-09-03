import { Field, ID, ObjectType } from '@nestjs/graphql';
import { DeckType } from '../../store/dto/deck.type';

@ObjectType('CartItem')
export class CartItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => DeckType)
  deck!: DeckType;

  @Field()
  createdAt!: Date;
}
