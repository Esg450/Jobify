import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '../common/validators.js';
import { CreateJobDto } from '../jobs/dto/create-job.dto.js';
import {
  JOB_EVENT_TYPES,
  JOB_STATUSES,
  type JobEventType,
  type JobStatus,
} from '../jobs/job.constants.js';

/** Version 2 added job hunts. Version 1 backups still import, into the active hunt. */
export const BACKUP_VERSION = 2;
export const SUPPORTED_BACKUP_VERSIONS = [1, 2];

export class BackupEventDto {
  @IsIn(JOB_EVENT_TYPES)
  type!: JobEventType;

  @IsOptional()
  @IsIn(JOB_STATUSES)
  fromStatus?: JobStatus | null;

  @IsOptional()
  @IsIn(JOB_STATUSES)
  toStatus?: JobStatus | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  body?: string | null;

  @IsISO8601()
  occurredAt!: string;
}

export class BackupHuntDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsCalendarDate()
  startedOn!: string;

  @IsOptional()
  @IsCalendarDate()
  endedOn?: string | null;
}

// Hunt ids differ between instances, so a backup refers to hunts by position instead.
export class BackupJobDto extends OmitType(CreateJobDto, ['huntId'] as const) {
  /** Index into the backup's `hunts`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  hunt?: number;

  @IsOptional()
  @IsISO8601()
  createdAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BackupEventDto)
  events?: BackupEventDto[];
}

export class BackupDto {
  @IsIn(SUPPORTED_BACKUP_VERSIONS)
  version!: number;

  @IsOptional()
  @IsISO8601()
  exportedAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BackupHuntDto)
  hunts?: BackupHuntDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BackupJobDto)
  jobs!: BackupJobDto[];
}
