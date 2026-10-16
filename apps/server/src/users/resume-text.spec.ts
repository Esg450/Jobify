import { BadRequestException } from '@nestjs/common';
import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  detectResumeFormat,
  extractResumeText,
  normalizeResumeText,
  truncateResumeText,
} from './resume-text.js';

/** A one-page PDF with the given lines of text. pdf.js rebuilds the missing xref table. */
function pdf(lines: string[]): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td ${lines
    .map((line) => `(${line}) Tj 0 -16 Td`)
    .join(' ')} ET`;
  return Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      'trailer << /Root 1 0 R >>',
      '%%EOF',
    ].join('\n'),
    'latin1',
  );
}

/** A stored (uncompressed) zip, which is all a .docx is. */
function zip(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(text);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    const local = Buffer.concat([header, nameBytes, data]);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4); // version made by
    record.writeUInt16LE(20, 6); // version needed
    record.writeUInt32LE(crc32(data), 16);
    record.writeUInt32LE(data.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(nameBytes.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([record, nameBytes]));
    locals.push(local);
    offset += local.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(locals.length, 8);
  end.writeUInt16LE(locals.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function docx(paragraphs: string[]): Buffer {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');
  return zip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  });
}

describe('detectResumeFormat', () => {
  it('goes by the bytes, not the name', () => {
    expect(detectResumeFormat(pdf(['x']))).toBe('pdf');
    expect(detectResumeFormat(docx(['x']))).toBe('docx');
    expect(detectResumeFormat(Buffer.from('Jane Doe\nEngineer'))).toBe('text');
  });

  it('rejects binary files that are neither', () => {
    expect(detectResumeFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]))).toBeUndefined();
    expect(detectResumeFormat(Buffer.from([0xff, 0xfe, 0xc3]))).toBeUndefined();
  });
});

describe('extractResumeText', () => {
  it('reads a PDF', async () => {
    const result = await extractResumeText(pdf(['Jane Doe', 'Senior Engineer']));
    expect(result.format).toBe('pdf');
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('Senior Engineer');
    expect(result.truncated).toBe(false);
  });

  it('reads a Word document', async () => {
    const result = await extractResumeText(docx(['Jane Doe', 'Senior Engineer']));
    expect(result).toEqual({
      format: 'docx',
      text: 'Jane Doe\n\nSenior Engineer',
      truncated: false,
    });
  });

  it('reads plain text, dropping a byte order mark', async () => {
    const result = await extractResumeText(Buffer.from('﻿Jane Doe\r\n\r\n\r\nEngineer'));
    expect(result).toEqual({ format: 'text', text: 'Jane Doe\n\nEngineer', truncated: false });
  });

  it('rejects unknown files, empty files and PDFs with no text', async () => {
    await expect(extractResumeText(Buffer.from([0x00, 0x01]))).rejects.toThrow(BadRequestException);
    await expect(extractResumeText(Buffer.from('   \n  '))).rejects.toThrow('empty');
    await expect(extractResumeText(pdf([]))).rejects.toThrow('No text found');
  });

  it('reports a corrupt Word document rather than crashing', async () => {
    await expect(extractResumeText(zip({ 'notes.txt': 'hello' }))).rejects.toThrow(
      'Could not read the Word document',
    );
  });

  it('truncates very long files and says so', async () => {
    const result = await extractResumeText(Buffer.from('line\n'.repeat(20_000)));
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(50_000);
    expect(result.text.endsWith('line')).toBe(true);
  });
});

describe('normalizeResumeText', () => {
  it('cleans up extraction artifacts without touching the words', () => {
    expect(normalizeResumeText('Jane Doe \t \r\n\r\n\r\n\r\nEngineer  \u0007\n')).toBe(
      'Jane Doe\n\nEngineer',
    );
  });
});

describe('truncateResumeText', () => {
  it('cuts at a line break when one is near the limit', () => {
    expect(truncateResumeText('one\ntwo\nthree', 9)).toBe('one\ntwo');
  });

  it('cuts hard when the only line break is far back', () => {
    expect(truncateResumeText('a\n' + 'b'.repeat(100), 50)).toHaveLength(50);
  });
});
