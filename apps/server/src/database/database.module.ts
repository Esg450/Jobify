import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Client } from '@libsql/client';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/configuration.js';
import { openDatabase, type Database } from './database.js';

export type { Database } from './database.js';

export const DATABASE = Symbol('DATABASE');
const CONNECTION = Symbol('CONNECTION');

@Global()
@Module({
  providers: [
    {
      provide: CONNECTION,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig) => {
        mkdirSync(config.dataDir, { recursive: true });
        const connection = await openDatabase(`file:${path.join(config.dataDir, 'jobify.db')}`);
        new Logger('Database').log(`Using ${config.dataDir}`);
        return connection;
      },
    },
    {
      provide: DATABASE,
      inject: [CONNECTION],
      useFactory: ({ db }: { db: Database }) => db,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(CONNECTION) private readonly connection: { client: Client }) {}

  onApplicationShutdown(): void {
    this.connection.client.close();
  }
}
