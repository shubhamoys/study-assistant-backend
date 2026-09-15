import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, MaxLength, MinLength } from 'class-validator';

/** No `slug` field — always derived from `name` server-side, see StoreService.createCategory. */
@InputType()
export class CreateCategoryInput {
  @Field()
  @MinLength(1, { message: 'Name cannot be empty' })
  @MaxLength(100)
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}
