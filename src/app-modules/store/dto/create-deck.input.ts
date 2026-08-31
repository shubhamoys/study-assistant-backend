import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Difficulty } from '../../../database/enums';

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

  @Field(() => ID)
  @IsUUID()
  categoryId!: string;

  @Field(() => Difficulty)
  @IsEnum(Difficulty)
  difficulty!: Difficulty;
}
