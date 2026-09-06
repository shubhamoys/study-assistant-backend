import appConfig from './app.config';
import jwtConfig from './jwt.config';
import mailConfig from './mail.config';
import razorpayConfig from './razorpay.config';
import storageConfig from './storage.config';
import throttlerConfig from './throttler.config';

// Note: no database.config.ts — src/database/data-source.ts reads
// DATABASE_URL directly (it must also work standalone for the TypeORM CLI,
// which never boots Nest's ConfigModule), so a ConfigService wrapper here
// would just be dead code.
export default [
  appConfig,
  jwtConfig,
  throttlerConfig,
  storageConfig,
  mailConfig,
  razorpayConfig,
];
