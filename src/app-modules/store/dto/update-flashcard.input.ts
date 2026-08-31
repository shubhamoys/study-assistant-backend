import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, MaxLength, Min, MinLength } from 'class-validator';

@InputType()
export class UpdateFlashcardInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @MinLength(1, { message: 'Front cannot be empty' })
  @MaxLength(5000)
  front?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MinLength(1, { message: 'Back cannot be empty' })
  @MaxLength(5000)
  back?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
