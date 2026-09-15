import { Field, Int, InputType } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, MaxLength, Min } from 'class-validator';

@InputType()
export class UpdateReviewInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}
