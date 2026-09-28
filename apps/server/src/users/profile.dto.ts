import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { UserProfile } from '../database/schema.js';

/** Information about the user that AI features use to personalize output. */
export class ProfileDto implements Partial<UserProfile> {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  resume?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  preferences?: string;
}

export const EMPTY_PROFILE: UserProfile = { name: '', headline: '', resume: '', preferences: '' };
