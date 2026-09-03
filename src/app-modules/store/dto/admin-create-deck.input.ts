import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Difficulty } from '../../../database/enums';

/**
 * Every deck created through this input is public (`isPublic: true`) — the
 * counterpart to CreateDeckInput's custom decks, which are always private.
 * Unlike CreateDeckInput, `categoryId`/`difficulty` are required here: a
 * platform-authored Store deck should always be filterable/browsable by
 * both, even though a custom deck no longer needs either (see the Phase 3
 * decision-log entry).
 */
@InputType()
export class AdminCreateDeckInput {
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

  @Field(() => ID)
  @IsUUID()
  categoryId!: string;

  @Field(() => Difficulty)
  @IsEnum(Difficulty)
  difficulty!: Difficulty;
}
