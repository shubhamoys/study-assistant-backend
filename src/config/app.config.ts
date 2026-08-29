import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  // Used to build links inside emails (verify/reset password) — the frontend
  // origin, not this API's own origin.
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  // Comma-separated list — lets dev keep both http://localhost:3000 and a
  // LAN IP (for testing from a phone on the same network) allowed at once.
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}));
