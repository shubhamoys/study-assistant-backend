import { join } from 'path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLFormattedError } from 'graphql';
import configs from './config';
import { HTTP_STATUS_TO_GRAPHQL_CODE } from './config/graphql-error-codes.config';
import { dataSourceOptions } from './database/data-source';
import { HealthModule } from './health/health.module';
import { GqlThrottlerGuard } from './shared/guards/gql-throttler.guard';
import { AuthModule } from './app-modules/auth/auth.module';
import { UsersModule } from './app-modules/users/users.module';
import { StoreModule } from './app-modules/store/store.module';
import { LibraryModule } from './app-modules/library/library.module';
import { StudyModule } from './app-modules/study/study.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttler.ttlMs')!,
          limit: config.get<number>('throttler.limit')!,
        },
      ],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('app.nodeEnv') === 'production';
        return {
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          // `playground: false` stops @nestjs/apollo from injecting the
          // legacy (deprecated) GraphQL Playground UI as its own default —
          // it also satisfies Apollo Server core's internal check that skips
          // ITS default landing page, since both look for the same
          // 'LandingPageDisabled' marker plugin. That leaves the `plugins`
          // array below as the only thing providing a landing page: real
          // Apollo Sandbox, dev-only, per TECHNICAL_REQUIREMENTS.md.
          playground: false,
          plugins: isProd
            ? []
            : [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
          introspection: !isProd,
          includeStacktraceInErrorResponses: !isProd,
          context: ({ req, res }: { req: unknown; res: unknown }) => ({
            req,
            res,
          }),
          formatError: (formattedError: GraphQLFormattedError) => {
            // @nestjs/apollo only auto-maps 4 HTTP statuses to a friendly
            // extensions.code (400/401/403/422); every other HttpException
            // (e.g. ConflictException -> 409) falls through to
            // INTERNAL_SERVER_ERROR even though it stashes the real status
            // in extensions.status. Fill that gap here so callers can branch
            // on `code` for the exceptions services actually throw.
            const status = formattedError.extensions?.status as
              number | undefined;
            const code =
              (status && HTTP_STATUS_TO_GRAPHQL_CODE[status]) ??
              formattedError.extensions?.code;

            if (isProd) {
              return {
                message: formattedError.message,
                extensions: { code },
              };
            }
            return {
              ...formattedError,
              extensions: { ...formattedError.extensions, code },
            };
          },
        };
      },
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    HealthModule,
    UsersModule,
    AuthModule,
    StoreModule,
    LibraryModule,
    StudyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
