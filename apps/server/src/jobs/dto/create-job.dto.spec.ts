import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RESUME_MAX_LENGTH } from '../../users/profile.constants.js';
import { UpdateJobDto } from './update-job.dto.js';

const errorsFor = (body: Record<string, unknown>) =>
  validate(plainToInstance(UpdateJobDto, body), { whitelist: true, forbidNonWhitelisted: true });

describe('UpdateJobDto profile', () => {
  it('accepts a partial profile, blank fields and clearing it with null', async () => {
    expect(await errorsFor({ profile: { resume: 'Tailored' } })).toEqual([]);
    expect(await errorsFor({ profile: { name: '', headline: '  ' } })).toEqual([]);
    expect(await errorsFor({ profile: {} })).toEqual([]);
    expect(await errorsFor({ profile: null })).toEqual([]);
    expect(await errorsFor({})).toEqual([]);
  });

  it('rejects unknown fields, non-objects and fields over the profile limits', async () => {
    expect(await errorsFor({ profile: { nickname: 'x' } })).not.toEqual([]);
    expect(await errorsFor({ profile: 'Tailored resume' })).not.toEqual([]);
    expect(await errorsFor({ profile: { name: 42 } })).not.toEqual([]);
    expect(await errorsFor({ profile: { resume: 'x'.repeat(RESUME_MAX_LENGTH + 1) } })).not.toEqual(
      [],
    );
  });
});
