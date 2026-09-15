import { Field, InputType } from '@nestjs/graphql';
import { MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateProfileInput {
  // Avatar is deliberately not settable here — it only ever changes via the
  // dedicated upload endpoint (POST /api/users/me/avatar), which writes the
  // resulting file URL itself. Letting a client paste an arbitrary URL into
  // this field would bypass that file's type/size checks entirely.
  @Field()
  @MinLength(1, { message: 'Display name cannot be empty' })
  @MaxLength(100)
  displayName!: string;
}
