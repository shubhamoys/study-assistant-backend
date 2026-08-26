import { join } from 'path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLFormattedError } from 'graphql';
import configs from './config';
import { dataSourceOptions } from './database/data-source';
import { HealthModule } from './health/health.module';
import { GqlThrottlerGuard } from './shared/guards/gql-throttler.guard';

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
          playground: false,
          introspection: !isProd,
          includeStacktraceInErrorResponses: !isProd,
          context: ({ req, res }: { req: unknown; res: unknown }) => ({
            req,
            res,
          }),
          formatError: (formattedError: GraphQLFormattedError) => {
            if (isProd) {
              const { message, extensions } = formattedError;
              return {
                message,
                extensions: { code: extensions?.code },
              };
            }
            return formattedError;
          },
        };
      },
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule {}
