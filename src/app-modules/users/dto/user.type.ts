import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '../../../database/enums';

registerEnumType(UserRole, { name: 'UserRole' });

/**
 * The public GraphQL shape of a user — deliberately separate from the
 * `User` TypeORM entity so persistence-only fields (passwordHash,
 * verificationToken, resetPasswordToken, resetPasswordExpires) can never be
 * exposed by accident. Resolvers return the entity directly; GraphQL reads
 * off matching property names and ignores the rest.
 */
@ObjectType('User')
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field()
  isEmailVerified!: boolean;

  @Field(() => String, { nullable: true })
  displayName!: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;

  // Only meaningful while isEmailVerified is false — lets the frontend
  // restore the resend cooldown countdown after a page refresh.
  @Field(() => Date, { nullable: true })
  verificationEmailSentAt!: Date | null;

  @Field()
  createdAt!: Date;
}
