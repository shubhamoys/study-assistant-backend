import { ArgsType, Field, ID } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Difficulty } from '../../../database/enums';
import { LibrarySortOrder } from './library-sort-order.enum';

@ArgsType()
export class MyLibraryArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @Field(() => Difficulty, { nullable: true })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @Field(() => LibrarySortOrder, { nullable: true })
  @IsOptional()
  @IsEnum(LibrarySortOrder)
  sort?: LibrarySortOrder;
}
