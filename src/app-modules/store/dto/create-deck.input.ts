import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Every deck created through this input is a custom/user deck — private,
 * no difficulty (removed entirely, see the Phase 3 decision-log entry),
 * category optional. A future admin-panel deck-creation input can still set
 * `difficulty`/a required `categoryId` on the same nullable columns.
 */
@InputType()
export class CreateDeckInput {
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
}
