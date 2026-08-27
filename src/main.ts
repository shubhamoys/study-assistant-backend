import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());

  app.enableCors({
    origin: config.get<string>('app.corsOrigin'),
    credentials: false, // Bearer-token auth — no cookies crossing origins.
  });

  // Global ValidationPipe is registered in AppModule (via APP_PIPE), not here
  // — that way it also applies when a test harness builds AppModule directly
  // without going through this bootstrap() function.

  const port = config.get<number>('app.port')!;
  await app.listen(port);

  console.log(`🚀 GraphQL API ready at http://localhost:${port}/graphql`);
}
void bootstrap();
