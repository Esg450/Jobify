import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * An append-only text file that rolls over to `name.1`, `name.2`, ... once it grows past
 * `maxBytes`, keeping at most `keep` old files. Writes are synchronous so lines are never
 * lost or reordered, which is fine at the volume Jobify logs.
 */
export class RotatingFile {
  private size: number;

  constructor(
    readonly filePath: string,
    private readonly maxBytes = 5 * 1024 * 1024,
    private readonly keep = 3,
  ) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.size = existsSync(filePath) ? statSync(filePath).size : 0;
  }

  write(text: string): void {
    const bytes = Buffer.byteLength(text);
    if (this.size > 0 && this.size + bytes > this.maxBytes) this.rotate();
    appendFileSync(this.filePath, text);
    this.size += bytes;
  }

  private rotate(): void {
    rmSync(`${this.filePath}.${this.keep}`, { force: true });
    for (let index = this.keep - 1; index >= 1; index--) {
      const from = `${this.filePath}.${index}`;
      if (existsSync(from)) renameSync(from, `${this.filePath}.${index + 1}`);
    }
    renameSync(this.filePath, `${this.filePath}.1`);
    this.size = 0;
  }
}
