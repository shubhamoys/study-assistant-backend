import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  email!: string;

  // MaxLength(72): bcrypt silently truncates/ignores input beyond 72 bytes.
  @Field()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72)
  password!: string;

  // Matches UpdateProfileInput.displayName's constraints — same column,
  // same rules, just required here (optional/editable later from Account).
  @Field()
  @IsNotEmpty({ message: 'Display name cannot be empty' })
  @MaxLength(100)
  displayName!: string;
}
