import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BackupModule } from './backup/backup.module.js';
import { ConfigModule } from './config/config.module.js';
import { loadConfig } from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { ImportModule } from './importers/import.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { StatsModule } from './stats/stats.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SettingsModule,
    AuthModule,
    JobsModule,
    ImportModule,
    AiModule,
    StatsModule,
    BackupModule,
    // Serves the built React app; client-side routes fall back to index.html.
    ServeStaticModule.forRoot({
      rootPath: loadConfig().staticDir,
      exclude: ['/api/{*path}'],
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
