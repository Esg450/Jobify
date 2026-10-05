import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCalendarDate } from '../common/validators.js';

export class CreateHuntDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  /** Defaults to today. */
  @IsOptional()
  @IsCalendarDate()
  startedOn?: string;
}

export class UpdateHuntDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsCalendarDate()
  startedOn?: string;

  /** A date finishes the hunt; `null` reopens it. */
  @IsOptional()
  @IsCalendarDate()
  endedOn?: string | null;
}
