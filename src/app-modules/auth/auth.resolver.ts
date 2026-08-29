import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthPayload } from './dto/auth-payload.type';
import { ChangePasswordInput } from './dto/change-password.input';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { ResetPasswordInput } from './dto/reset-password.input';
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

  // The refresh token itself is the credential here — no access token
  // required (it may well have already expired, that's the whole point).
  @Public()
  @Mutation(() => AuthPayload)
  refreshToken(
    @Args('refreshToken') refreshToken: string,
  ): Promise<AuthPayload> {
    return this.authService.refreshTokens(refreshToken);
  }

  // Requires auth (default) so we know which user's token to revoke, in
  // addition to the token itself matching.
  @Mutation(() => Boolean)
  logout(
    @Args('refreshToken') refreshToken: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.authService.logout(user.id, refreshToken);
  }

  @Public()
  @Mutation(() => Boolean)
  verifyEmail(@Args('token') token: string): Promise<boolean> {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Mutation(() => Boolean)
  forgotPassword(@Args('email') email: string): Promise<boolean> {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Mutation(() => Boolean)
  resetPassword(@Args('input') input: ResetPasswordInput): Promise<boolean> {
    return this.authService.resetPassword(input);
  }

  @Mutation(() => Boolean)
  changePassword(
    @Args('input') input: ChangePasswordInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.authService.changePassword(user.id, input);
  }

  @Query(() => UserType)
  me(@CurrentUser() user: User): User {
    return user;
  }
}
