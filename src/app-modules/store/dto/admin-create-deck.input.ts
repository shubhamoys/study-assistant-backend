import { Field, ID, Int, InputType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
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
 *
 * `priceRupees` (whole rupees, e.g. 499) is what the admin types — the
 * service converts it to `Deck.price` (paise) by multiplying by 100, so the
 * integer-lowest-denomination storage convention (see DATABASE_DESIGN.md
 * §4.3) never leaks into the admin UI. Required (and validated >= 1) only
 * when `isFree` is explicitly `false`; ignored otherwise.
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

  @Field(() => Boolean, { defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Price must be at least ₹1' })
  priceRupees?: number;
}
