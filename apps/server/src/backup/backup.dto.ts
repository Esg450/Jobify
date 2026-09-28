import { Type } from 'class-transformer';
import {
  Equals,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateJobDto } from '../jobs/dto/create-job.dto.js';
import {
  JOB_EVENT_TYPES,
  JOB_STATUSES,
  type JobEventType,
  type JobStatus,
} from '../jobs/job.constants.js';

export const BACKUP_VERSION = 1;

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

export class BackupJobDto extends CreateJobDto {
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
  @Equals(BACKUP_VERSION)
  version!: number;

  @IsOptional()
  @IsISO8601()
  exportedAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BackupJobDto)
  jobs!: BackupJobDto[];
}
