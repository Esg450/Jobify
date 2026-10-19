import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { QueryJobsDto } from './query-jobs.dto.js';

const parse = async (query: Record<string, unknown>) => {
  const dto = plainToInstance(QueryJobsDto, query);
  return { dto, errors: await validate(dto) };
};

describe('QueryJobsDto tags', () => {
  it('keeps commas inside a tag name', async () => {
    const { dto, errors } = await parse({ tags: 'C++, Rust' });
    expect(errors).toEqual([]);
    expect(dto.tags).toEqual(['C++, Rust']);
  });

  it('accepts one param per tag', async () => {
    const { dto } = await parse({ tags: ['remote', 'C++, Rust'] });
    expect(dto.tags).toEqual(['remote', 'C++, Rust']);
  });
});
