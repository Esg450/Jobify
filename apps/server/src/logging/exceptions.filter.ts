import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';

/**
 * Adds the failing request to the log. Client errors (bad input, not found, ...) are logged
 * as warnings with the message the user saw; server errors are logged with the route, and
 * Nest's base filter then logs the stack trace.
 */
@Catch()
export class LoggingExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('HTTP');

  override catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const route = `${request.method} ${request.originalUrl}`;

    if (exception instanceof HttpException && exception.getStatus() < 500) {
      // An expired session is routine, not worth a warning.
      if (exception.getStatus() !== HttpStatus.UNAUTHORIZED) {
        this.logger.warn(
          `${route} ${exception.getStatus()}: ${LoggingExceptionFilter.message(exception)}`,
        );
      }
    } else {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      this.logger.error(
        `${route} ${status}: ${exception instanceof Error ? exception.message : String(exception)}`,
      );
    }

    super.catch(exception, host);
  }

  private static message(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    const { message } = response as { message?: string | string[] };
    return Array.isArray(message) ? message.join('; ') : (message ?? exception.message);
  }
}
