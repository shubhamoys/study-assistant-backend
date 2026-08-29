import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Matches http://<private-LAN-IP>:<any-port> — origins Node's http server
// itself would resolve to (RFC 1918 ranges), so a phone/tablet on the same
// Wi-Fi can reach the API when the frontend is started with `next dev -H
// 0.0.0.0` per the dev "test on mobile" workflow. Dev-only (see isProd
// check below); never relaxes CORS for a production deployment.
const LAN_ORIGIN_PATTERN =
  /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):\d+$/;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());

  // Only affects REST controllers (the avatar upload endpoint) — the
  // GraphQL module registers its own route directly against the HTTP
  // adapter and stays at /graphql regardless of this prefix.
  app.setGlobalPrefix(config.get<string>('app.apiPrefix')!);

  // Serves study-assistant-backend/uploads/** at /uploads/** so an
  // avatarUrl like /uploads/avatars/<id>.png actually resolves to a real
  // image in the browser. Local-storage dev stand-in for Cloudflare R2 (see
  // storage.config.ts) — R2 serves these directly from its own public URL
  // in production, this route won't exist there.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const isProd = config.get<string>('app.nodeEnv') === 'production';
  const allowedOrigins = config.get<string[]>('app.corsOrigins')!;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // No Origin header (curl, server-to-server, GraphQL Sandbox's own
      // fetch) — nothing to check against, allow it through.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProd && LAN_ORIGIN_PATTERN.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
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
