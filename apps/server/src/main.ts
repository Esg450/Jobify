import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/configuration.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);

  // Jobify is commonly run behind a reverse proxy; trust it for protocol detection.
  app.set('trust proxy', true);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Backups and pasted page HTML can be large.
  app.useBodyParser('json', { limit: '25mb' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
  new Logger('Jobify').log(`Listening on http://${config.host}:${config.port}`);
}

void bootstrap();
