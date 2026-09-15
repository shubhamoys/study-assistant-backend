import { Field, Int, ObjectType } from '@nestjs/graphql';
import { UserType } from './user.type';

@ObjectType('AdminUserPage')
export class AdminUserPage {
  @Field(() => [UserType])
  items!: UserType[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  totalPages!: number;
}
