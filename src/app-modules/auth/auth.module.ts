import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { MailModule } from '../../shared/mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.accessExpiresIn') as StringValue,
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    // Global: every resolver requires auth unless marked @Public(). Registered
    // here (not AppModule) so this module fully owns the auth concern.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
