import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

/** No `role` field — every account created through this input is an admin; see UsersService.createAdmin. Mirrors RegisterInput's validation. */
@InputType()
export class CreateAdminUserInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72)
  password!: string;

  @Field()
  @IsNotEmpty({ message: 'Display name cannot be empty' })
  @MaxLength(100)
  displayName!: string;
}
