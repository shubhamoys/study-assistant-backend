import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { entities } from './entities';

// Loaded directly (rather than via @nestjs/config) so this file works both
// as the running app's TypeORM config AND standalone, invoked by the TypeORM
// CLI for migrations (`npm run migration:*`), which never boots Nest.
loadEnv();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities,
  // Matches both compiled (dist/database/migrations/*.js at runtime) and
  // source (src/database/migrations/*.ts, run via ts-node by the CLI) paths.
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // Migrations only, always — see AGENT_CONTEXT.md "Database" section for why.
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
};

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
