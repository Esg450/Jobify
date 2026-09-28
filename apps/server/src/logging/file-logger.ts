import { inspect } from 'node:util';
import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import type { RotatingFile } from './rotating-file.js';

const LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/** Nest's startup chatter (one line per module and route); only shown at debug level. */
const STARTUP_CONTEXTS = new Set(['InstanceLoader', 'RoutesResolver', 'RouterExplorer']);

/** The levels to print for a LOG_LEVEL setting: that level and everything more severe. */
export function logLevelsFrom(level: string | undefined): LogLevel[] {
  const index = LEVELS.indexOf((level ?? 'log').toLowerCase() as LogLevel);
  return LEVELS.slice(0, (index < 0 ? LEVELS.indexOf('log') : index) + 1);
}

/** Nest's console logger that also appends plain-text lines (no colors) to a log file. */
export class FileLogger extends ConsoleLogger {
  constructor(
    private readonly file: RotatingFile,
    logLevels: LogLevel[],
  ) {
    super({ logLevels });
  }

  protected override printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
    params?: Record<string, unknown>,
  ): void {
    if (logLevel === 'log' && STARTUP_CONTEXTS.has(context) && !this.isLevelEnabled('debug'))
      return;
    super.printMessages(messages, context, logLevel, writeStreamType, errorStack, params);

    const prefix = `${new Date().toISOString()} ${logLevel.toUpperCase().padEnd(7)}${context ? ` [${context}]` : ''}`;
    for (const message of messages) {
      const text =
        typeof message === 'string'
          ? message
          : inspect(message, { depth: 5, breakLength: Infinity });
      this.file.write(`${prefix} ${text}\n`);
    }
    if (typeof errorStack === 'string' && errorStack) this.file.write(`${errorStack}\n`);
  }
}
