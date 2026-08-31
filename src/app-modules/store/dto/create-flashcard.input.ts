import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateFlashcardInput {
  @Field(() => ID)
  @IsUUID()
  deckId!: string;

  @Field()
  @MinLength(1, { message: 'Front cannot be empty' })
  @MaxLength(5000)
  front!: string;

  @Field()
  @MinLength(1, { message: 'Back cannot be empty' })
  @MaxLength(5000)
  back!: string;

  // Omit to append at the end of the deck (the resolver assigns max+1).
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
