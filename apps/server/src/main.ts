import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/configuration.js';
import { LoggingExceptionFilter } from './logging/exceptions.filter.js';
import { FileLogger, logLevelsFrom } from './logging/file-logger.js';
import { LOG_FILE } from './logging/log-file.js';
import { requestLogger } from './logging/request-logger.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = new FileLogger(LOG_FILE, logLevelsFrom(config.logLevel));

  process.on('unhandledRejection', (reason) =>
    logger.error(
      `Unhandled promise rejection: ${String(reason)}`,
      (reason as Error)?.stack,
      'Process',
    ),
  );
  process.on('uncaughtException', (error) => {
    logger.fatal(`Uncaught exception: ${error.message}`, error.stack, 'Process');
    process.exit(1);
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });

  // Jobify is commonly run behind a reverse proxy; trust it for protocol detection.
  app.set('trust proxy', true);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(requestLogger);
  // Backups and pasted page HTML can be large.
  app.useBodyParser('json', { limit: '25mb' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new LoggingExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
  new Logger('Jobify').log(
    `Jobify ${config.version} listening on http://${config.host}:${config.port}, logging to ${LOG_FILE.filePath}`,
  );
}

void bootstrap();
