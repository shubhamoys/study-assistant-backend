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

/** See AdminCreateDeckInput's doc comment for the `priceRupees` conversion rule. */
@InputType()
export class AdminUpdateDeckInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @MinLength(1, { message: 'Title cannot be empty' })
  @MaxLength(255)
  title?: string;

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

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Price must be at least ₹1' })
  priceRupees?: number;
}
