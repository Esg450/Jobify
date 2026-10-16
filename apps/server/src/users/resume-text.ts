import { BadRequestException } from '@nestjs/common';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { RESUME_MAX_LENGTH, type ResumeFileFormat } from './profile.constants.js';

export interface ResumeText {
  text: string;
  format: ResumeFileFormat;
  /** True when the file held more than the profile can store and the end was dropped. */
  truncated: boolean;
}

const PDF_MAGIC = '%PDF-';
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Works out what kind of file this is from its bytes rather than its name or declared MIME type,
 * which the browser guesses and an attacker chooses. Anything that is not a PDF or a Word
 * document is accepted as plain text as long as it decodes as UTF-8 and has no NUL bytes.
 */
export function detectResumeFormat(buffer: Buffer): ResumeFileFormat | undefined {
  if (buffer.subarray(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC) return 'pdf';
  if (buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) return 'docx';
  if (buffer.includes(0)) return undefined;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return 'text';
  } catch {
    return undefined;
  }
}

/**
 * Tidies extracted text without changing its words: Windows line endings, stray control
 * characters, trailing spaces and runs of blank lines all come from the extraction, not the
 * resume. The result is what the user sees in the textarea, so it should look like something
 * they could have pasted themselves.
 */
export function normalizeResumeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ') // Tabs, non-breaking spaces and other odd whitespace.
    .replace(/[\p{Cc}\p{Cf}]/gu, (char) => (char === '\n' ? char : ''))
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Cuts at the last line break before the limit, so the text never ends mid-word. */
export function truncateResumeText(text: string, limit = RESUME_MAX_LENGTH): ResumeText['text'] {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf('\n', limit);
  return text.slice(0, cut > limit / 2 ? cut : limit).trimEnd();
}

async function readPdf(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return text;
}

async function readDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

function readText(buffer: Buffer): string {
  const body = buffer.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)
    ? buffer.subarray(UTF8_BOM.length)
    : buffer;
  return body.toString('utf8');
}

/**
 * Turns an uploaded resume into the plain text the profile stores. Only the text leaves this
 * function; the file itself is never written anywhere.
 */
export async function extractResumeText(buffer: Buffer): Promise<ResumeText> {
  const format = detectResumeFormat(buffer);
  if (!format) {
    throw new BadRequestException('Upload a PDF, Word document (.docx) or plain text file.');
  }

  let raw: string;
  try {
    raw =
      format === 'pdf'
        ? await readPdf(buffer)
        : format === 'docx'
          ? await readDocx(buffer)
          : readText(buffer);
  } catch {
    throw new BadRequestException(
      `Could not read the ${format === 'pdf' ? 'PDF' : 'Word document'}. Check that the file opens, or paste the text instead.`,
    );
  }

  const text = normalizeResumeText(raw);
  if (!text) {
    throw new BadRequestException(
      format === 'pdf'
        ? 'No text found in the PDF. If it is a scanned image, paste the text instead.'
        : 'The file is empty.',
    );
  }

  const kept = truncateResumeText(text);
  return { text: kept, format, truncated: kept.length < text.length };
}
