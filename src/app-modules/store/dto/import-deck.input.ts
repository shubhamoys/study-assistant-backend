import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Difficulty } from '../../../database/enums';
import { ImportFlashcardInput } from './import-flashcard.input';

/**
 * The deck-export JSON's `deck`/`flashcards` fields, reshaped into a mutation
 * input — see `src/lib/deck-export.ts` in the frontend for the file format
 * this mirrors. Always produces a private custom deck, same as
 * CreateDeckInput; `difficulty` is accepted (an older export may carry one
 * from before it was removed from deck creation) but not required.
 */
@InputType()
export class ImportDeckInput {
  @Field()
  @MinLength(1, { message: 'Title cannot be empty' })
  @MaxLength(255)
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(512)
  coverUrl?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Field(() => Difficulty, { nullable: true })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @Field(() => [ImportFlashcardInput])
  @ValidateNested({ each: true })
  @Type(() => ImportFlashcardInput)
  @ArrayMaxSize(1000, { message: 'A deck can have at most 1000 cards' })
  flashcards!: ImportFlashcardInput[];
}
