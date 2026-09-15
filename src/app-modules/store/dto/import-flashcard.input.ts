import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Min, MaxLength, MinLength } from 'class-validator';

/** One card inside an ImportDeckInput — same constraints as CreateFlashcardInput, minus `deckId` (the whole batch belongs to the deck being created). */
@InputType()
export class ImportFlashcardInput {
  @Field()
  @MinLength(1, { message: 'Front cannot be empty' })
  @MaxLength(5000)
  front!: string;

  @Field()
  @MinLength(1, { message: 'Back cannot be empty' })
  @MaxLength(5000)
  back!: string;

  // Omit to use the card's position in the array.
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
