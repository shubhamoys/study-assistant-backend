import { Field, ObjectType } from '@nestjs/graphql';
import { UserType } from '../../users/dto/user.type';

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken!: string;

  @Field(() => UserType)
  user!: UserType;
}
