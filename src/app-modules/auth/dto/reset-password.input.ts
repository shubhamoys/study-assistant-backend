import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class ResetPasswordInput {
  // A field needs at least one class-validator decorator or the global
  // ValidationPipe's whitelist mode strips/rejects it as an unknown property
  // — see the RegisterInput/LoginInput precedent (every field is decorated).
  @Field()
  @IsString()
  @IsNotEmpty()
  token!: string;

  // MaxLength(72): bcrypt silently truncates/ignores input beyond 72 bytes.
  @Field()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72)
  newPassword!: string;
}
