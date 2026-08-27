import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthPayload } from './dto/auth-payload.type';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { UserType } from '../users/dto/user.type';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Mutation(() => AuthPayload)
  register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Public()
  @Mutation(() => AuthPayload)
  login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input);
  }

  // Phase 1 is stateless (access token only, no refresh token/session to
  // revoke) — this just proves the guard chain works end to end. Gains real
  // server-side effect (revoking refresh tokens) in Phase 2.
  @Mutation(() => Boolean)
  logout(): boolean {
    return true;
  }

  @Query(() => UserType)
  me(@CurrentUser() user: User): User {
    return user;
  }
}
