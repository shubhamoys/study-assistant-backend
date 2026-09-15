import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import ms from 'ms';
import type { StringValue } from 'ms';
import { IsNull, Repository } from 'typeorm';
import { MailService } from '../../shared/mail/mail.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthPayload } from './dto/auth-payload.type';
import { ChangePasswordInput } from './dto/change-password.input';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { ResetPasswordInput } from './dto/reset-password.input';
import { RefreshToken } from './entities/refresh-token.entity';
import { generateOpaqueToken, hashToken } from './token.util';

const RESET_PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESEND_VERIFICATION_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
  ) {}

  async register(input: RegisterInput): Promise<AuthPayload> {
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const saltRounds = this.configService.get<number>('jwt.bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);
    const { raw: verificationToken, hash: verificationTokenHash } =
      generateOpaqueToken();

    const user = await this.usersService.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      verificationToken: verificationTokenHash,
    });

    // Best-effort: a broken/unconfigured mail provider shouldn't block
    // account creation — isEmailVerified just stays false (no hard gate
    // anywhere else in the app) until the user follows the link.
    void this.mailService
      .sendVerificationEmail(user.email, verificationToken)
      .catch(() => {});

    return this.buildAuthPayload(user);
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const user = await this.usersService.findByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthPayload(user);
  }

  async refreshTokens(rawRefreshToken: string): Promise<AuthPayload> {
    const hash = hashToken(rawRefreshToken);
    const existing = await this.refreshTokensRepository.findOneBy({
      token: hash,
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotation: the presented token is single-use — revoke it now and issue
    // a fresh pair, so a stolen-and-replayed refresh token stops working the
    // moment the legitimate client uses it first.
    existing.revokedAt = new Date();
    await this.refreshTokensRepository.save(existing);

    const user = await this.usersService.findById(existing.userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.buildAuthPayload(user);
  }

  /** Idempotent: revoking a token that doesn't match/exist is a silent no-op. */
  async logout(userId: string, rawRefreshToken: string): Promise<boolean> {
    const hash = hashToken(rawRefreshToken);
    await this.refreshTokensRepository.update(
      { token: hash, userId },
      { revokedAt: new Date() },
    );
    return true;
  }

  async verifyEmail(rawToken: string): Promise<boolean> {
    const hash = hashToken(rawToken);
    const user = await this.usersService.findByVerificationToken(hash);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.update(user.id, {
      isEmailVerified: true,
      verificationToken: null,
    });
    return true;
  }

  /** Idempotent: silently a no-op (still returns true) if the account is already verified — the frontend only shows this option while unverified, but a resolver shouldn't error on a harmless double-click/race. */
  async resendVerificationEmail(user: User): Promise<boolean> {
    if (user.isEmailVerified) {
      return true;
    }

    // Server-side cooldown: verificationEmailSentAt is persisted, so this
    // holds even across a page refresh or a second tab — the frontend's own
    // countdown is just UX, this is the actual enforcement.
    if (user.verificationEmailSentAt) {
      const elapsedMs = Date.now() - user.verificationEmailSentAt.getTime();
      if (elapsedMs < RESEND_VERIFICATION_COOLDOWN_MS) {
        // Passed as an object (not just a message string) so the response
        // body includes `statusCode` — @nestjs/apollo only maps an
        // HttpException to a GraphQL extensions.status when it does (see
        // apollo-base.driver.js's `isHttpException` check); a plain string
        // response falls through as INTERNAL_SERVER_ERROR instead of 429.
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Please wait before requesting another verification email',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const { raw, hash } = generateOpaqueToken();
    await this.usersService.update(user.id, {
      verificationToken: hash,
      verificationEmailSentAt: new Date(),
    });

    // Overwriting the stored hash means any link from a previous email
    // stops working the moment a new one is requested — same one-active-
    // token-at-a-time model as the reset-password token.
    void this.mailService
      .sendVerificationEmail(user.email, raw)
      .catch(() => {});
    return true;
  }

  async forgotPassword(email: string): Promise<boolean> {
    const user = await this.usersService.findByEmail(email);
    // Always resolve true — don't reveal whether an account exists for this
    // email address (user-enumeration protection).
    if (!user) return true;

    const { raw, hash } = generateOpaqueToken();
    await this.usersService.update(user.id, {
      resetPasswordToken: hash,
      resetPasswordExpires: new Date(Date.now() + RESET_PASSWORD_TOKEN_TTL_MS),
    });

    void this.mailService
      .sendPasswordResetEmail(user.email, raw)
      .catch(() => {});
    return true;
  }

  async resetPassword(input: ResetPasswordInput): Promise<boolean> {
    const hash = hashToken(input.token);
    const user = await this.usersService.findByValidResetToken(hash);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const saltRounds = this.configService.get<number>('jwt.bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(input.newPassword, saltRounds);
    await this.usersService.update(user.id, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    // A password reset is a strong compromise-recovery signal — kill every
    // existing session so a stolen access/refresh token pair from before the
    // reset stops working.
    await this.revokeAllRefreshTokens(user.id);
    return true;
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (
      !user ||
      !(await bcrypt.compare(input.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const saltRounds = this.configService.get<number>('jwt.bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(input.newPassword, saltRounds);
    await this.usersService.update(userId, { passwordHash });
    await this.revokeAllRefreshTokens(userId);
    return true;
  }

  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokensRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async buildAuthPayload(user: User): Promise<AuthPayload> {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const { raw: refreshToken, hash } = generateOpaqueToken();
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    )!;
    const refreshTokenRow = this.refreshTokensRepository.create({
      token: hash,
      userId: user.id,
      expiresAt: new Date(Date.now() + ms(refreshExpiresIn as StringValue)),
    });
    await this.refreshTokensRepository.save(refreshTokenRow);

    return { accessToken, refreshToken, user };
  }
}
