import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateCategoryInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @MinLength(1, { message: 'Name cannot be empty' })
  @MaxLength(100)
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}
