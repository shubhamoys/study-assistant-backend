import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

@InputType()
export class CreateReviewInput {
  @Field(() => ID)
  @IsUUID()
  deckId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}
