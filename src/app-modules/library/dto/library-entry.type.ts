import { Field, ID, ObjectType } from '@nestjs/graphql';
import { DeckType } from '../../store/dto/deck.type';

@ObjectType('LibraryEntry')
export class LibraryEntryType {
  @Field(() => ID)
  id!: string;

  @Field(() => DeckType)
  deck!: DeckType;

  @Field(() => Date, { nullable: true })
  lastStudiedAt!: Date | null;

  @Field()
  createdAt!: Date;
}
