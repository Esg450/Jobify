import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/** Logs every API request with its status and duration when LOG_LEVEL is debug or verbose. */
export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  if (!request.originalUrl.startsWith('/api/')) return next();

  const started = performance.now();
  response.on('finish', () => {
    const duration = Math.round(performance.now() - started);
    logger.debug(`${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms`);
  });
  next();
}
