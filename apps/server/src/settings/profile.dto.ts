import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Information about the user that AI features use to personalize output. */
export class ProfileDto {
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

export type Profile = Required<{ [K in keyof ProfileDto]: string }>;

export const EMPTY_PROFILE: Profile = { name: '', headline: '', resume: '', preferences: '' };
