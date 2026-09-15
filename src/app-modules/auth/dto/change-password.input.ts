import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class ChangePasswordInput {
  // See ResetPasswordInput's note on why every field needs a decorator.
  @Field()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  // MaxLength(72): bcrypt silently truncates/ignores input beyond 72 bytes.
  @Field()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72)
  newPassword!: string;
}
