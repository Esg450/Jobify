import { createReadStream, existsSync } from 'node:fs';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminOnly, CurrentUser } from '../auth/decorators.js';
import { today } from '../common/dates.js';
import type { PublicUser } from '../users/users.service.js';
import { LOG_FILE } from './log-file.js';

class ClientErrorDto {
  @IsString()
  @MaxLength(2_000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  url?: string;
}

@Controller('logs')
export class LogsController {
  private readonly clientLogger = new Logger('Web');

  /** The current log file, for admins troubleshooting without shell access. */
  @Get()
  @AdminOnly()
  download(): StreamableFile {
    if (!existsSync(LOG_FILE.filePath)) throw new NotFoundException('Nothing has been logged yet');
    return new StreamableFile(createReadStream(LOG_FILE.filePath), {
      type: 'text/plain; charset=utf-8',
      disposition: `attachment; filename="jobify-${today()}.log"`,
    });
  }

  /** Errors from the browser, so problems in the web app show up in the same log. */
  @Post('client')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  reportClientError(@CurrentUser() user: PublicUser, @Body() dto: ClientErrorDto): void {
    const where = dto.url ? ` at ${dto.url}` : '';
    this.clientLogger.error(
      `${dto.message} (user ${user.username}${where})`,
      ...(dto.stack ? [dto.stack] : []),
    );
  }
}
