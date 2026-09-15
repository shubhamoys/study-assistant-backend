import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';

/** No `difficulty` — a custom deck never has one, see CreateDeckInput's comment. */
@InputType()
export class UpdateDeckInput {
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
}
