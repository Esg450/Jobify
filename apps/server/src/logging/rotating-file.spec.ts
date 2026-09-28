import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { logLevelsFrom } from './file-logger.js';
import { RotatingFile } from './rotating-file.js';

describe('RotatingFile', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'jobify-logs-'));
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('rolls over when full and keeps a limited number of old files', () => {
    const file = new RotatingFile(path.join(directory, 'logs', 'app.log'), 10, 2);
    for (const line of ['aaaaaaaa\n', 'bbbbbbbb\n', 'cccccccc\n', 'dddddddd\n']) file.write(line);

    expect(readdirSync(path.join(directory, 'logs')).sort()).toEqual([
      'app.log',
      'app.log.1',
      'app.log.2',
    ]);
    expect(readFileSync(file.filePath, 'utf8')).toBe('dddddddd\n');
    expect(readFileSync(`${file.filePath}.1`, 'utf8')).toBe('cccccccc\n');
    expect(readFileSync(`${file.filePath}.2`, 'utf8')).toBe('bbbbbbbb\n');
  });
});

describe('logLevelsFrom', () => {
  it('includes the chosen level and everything more severe', () => {
    expect(logLevelsFrom('warn')).toEqual(['fatal', 'error', 'warn']);
    expect(logLevelsFrom('DEBUG')).toEqual(['fatal', 'error', 'warn', 'log', 'debug']);
  });

  it('defaults to log for unknown or missing values', () => {
    expect(logLevelsFrom(undefined)).toEqual(['fatal', 'error', 'warn', 'log']);
    expect(logLevelsFrom('loud')).toEqual(['fatal', 'error', 'warn', 'log']);
  });
});
